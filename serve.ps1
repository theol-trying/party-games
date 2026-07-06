# Mini serveur statique + API de persistance, sans dépendance (PowerShell).
# Usage :  clic droit → « Exécuter avec PowerShell », ou :
#          powershell -ExecutionPolicy Bypass -File serve.ps1
# Puis ouvre http://localhost:5178
#
# Il reproduit en local l'API du serveur Node (server.js) :
#   GET  /api/kv/<clé>      -> { key, value }   (404 si absente)
#   PUT  /api/kv/<clé>      body { value: ... } -> { key, ok:true }
#   GET  /api/health
# Les données sont persistées dans kv-local.data (à côté de ce script).

param([int]$Port = 5178)

# TLS 1.2 pour les appels sortants (iTunes / Deezer) sous Windows PowerShell 5.1.
try { [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 } catch {}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$kvFile = Join-Path $root "kv-local.data"

# ---- Chargement du magasin clé/valeur (clé <TAB> json compact) ----
$script:KV = @{}
if (Test-Path $kvFile) {
  foreach ($line in [System.IO.File]::ReadAllLines($kvFile)) {
    if ($line -match "^(.*?)`t(.*)$") { $script:KV[$Matches[1]] = $Matches[2] }
  }
}
function Save-KV {
  $lines = foreach ($k in $script:KV.Keys) { "$k`t$($script:KV[$k])" }
  [System.IO.File]::WriteAllLines($kvFile, [string[]]$lines)
}

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".mjs" = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"; ".svg" = "image/svg+xml"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"; ".mp3" = "audio/mpeg"; ".wav" = "audio/wav"; ".ico" = "image/x-icon"
}

function Send-Response($stream, $status, $ctype, [byte[]]$body) {
  $header = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($hb, 0, $hb.Length)
  $stream.Write($body, 0, $body.Length)
  $stream.Flush()
}
function Send-Json($stream, $status, $json) {
  Send-Response $stream $status "application/json; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes($json))
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Soiree servi sur  http://localhost:$Port   (Ctrl+C pour arreter)" -ForegroundColor Green

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    # Timeouts : une socket ouverte sans requête (preconnect navigateur) ne doit
    # pas figer ce serveur mono-thread ; elle expire et libère la boucle.
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 5000
    try {
      $stream = $client.GetStream()

      # ---- Lecture brute : en-têtes puis corps (Content-Length) ----
      $buffer = New-Object byte[] 8192
      $ms = New-Object System.IO.MemoryStream
      $headerEnd = -1
      while ($headerEnd -lt 0) {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { break }
        $ms.Write($buffer, 0, $read)
        $txt = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
        $headerEnd = $txt.IndexOf("`r`n`r`n")
      }
      if ($headerEnd -lt 0) { $client.Close(); continue }

      $all = $ms.ToArray()
      $headerText = [System.Text.Encoding]::ASCII.GetString($all, 0, $headerEnd)
      $lines = $headerText -split "`r`n"
      $requestLine = $lines[0]
      $contentLength = 0
      foreach ($l in $lines) { if ($l -match '^(?i)Content-Length:\s*(\d+)') { $contentLength = [int]$Matches[1] } }

      $bodyStart = $headerEnd + 4
      $have = $all.Length - $bodyStart
      while ($have -lt $contentLength) {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { break }
        $ms.Write($buffer, 0, $read); $have += $read
      }
      $all = $ms.ToArray()
      $body = ""
      if ($contentLength -gt 0) {
        $body = [System.Text.Encoding]::UTF8.GetString($all, $bodyStart, [Math]::Min($contentLength, $all.Length - $bodyStart))
      }

      $parts = $requestLine.Split(' ')
      $method = $parts[0]
      $rawPath = $parts[1]
      $urlPath = [System.Uri]::UnescapeDataString($rawPath.Split('?')[0])

      # ---- Routes API ----
      if ($urlPath -eq "/api/health") {
        Send-Json $stream "200 OK" '{"ok":true,"redis":false,"mode":"local-file"}'
        $client.Close(); continue
      }
      if ($urlPath -eq "/api/music") {
        $qs = @{}
        if ($rawPath.Contains("?")) {
          foreach ($pair in ($rawPath.Split("?", 2)[1] -split "&")) {
            $kv2 = $pair -split "=", 2
            if ($kv2.Length -eq 2) { $qs[$kv2[0]] = [System.Uri]::UnescapeDataString($kv2[1].Replace("+", " ")) }
          }
        }
        $query = $qs["q"]
        $provider = if ($qs["provider"] -eq "deezer") { "deezer" } else { "itunes" }
        $limit = 20; if ($qs["limit"]) { [int]::TryParse($qs["limit"], [ref]$limit) | Out-Null }
        if ($limit -lt 1) { $limit = 1 } elseif ($limit -gt 30) { $limit = 30 }
        if ([string]::IsNullOrWhiteSpace($query)) {
          Send-Json $stream "400 Bad Request" '{"error":"requete vide"}'; $client.Close(); continue
        }
        try {
          $enc = [System.Uri]::EscapeDataString($query)
          if ($provider -eq "deezer") {
            $data = Invoke-RestMethod "https://api.deezer.com/search?limit=$limit&q=$enc" -TimeoutSec 8
            $out = foreach ($tk in $data.data) { if ($tk.preview) { [pscustomobject]@{ title = $tk.title; artist = $tk.artist.name; preview = $tk.preview; artwork = $tk.album.cover_medium } } }
          } else {
            $data = Invoke-RestMethod "https://itunes.apple.com/search?media=music&entity=song&limit=$limit&term=$enc" -TimeoutSec 8
            $out = foreach ($tk in $data.results) { if ($tk.previewUrl) { [pscustomobject]@{ title = $tk.trackName; artist = $tk.artistName; preview = $tk.previewUrl; artwork = $tk.artworkUrl100 } } }
          }
          $json = (@{ provider = $provider; results = @($out) } | ConvertTo-Json -Depth 6 -Compress)
          Send-Json $stream "200 OK" $json
        } catch {
          Write-Host "[music] $($_.Exception.Message)" -ForegroundColor Yellow
          Send-Json $stream "502 Bad Gateway" '{"error":"recherche musicale indisponible"}'
        }
        $client.Close(); continue
      }
      if ($urlPath -like "/api/kv/*") {
        $key = $urlPath.Substring("/api/kv/".Length)
        # Mêmes contrôles que server.js : allowlist de clé + plafond de taille.
        if ($key -notmatch '^[A-Za-z0-9:_-]{1,80}$') {
          Send-Json $stream "400 Bad Request" '{"error":"cle invalide"}'
          $client.Close(); continue
        }
        if (($method -eq "PUT" -or $method -eq "POST") -and $contentLength -gt 32768) {
          Send-Json $stream "413 Payload Too Large" '{"error":"valeur trop volumineuse"}'
          $client.Close(); continue
        }
        if ($method -eq "GET") {
          if ($script:KV.ContainsKey($key)) {
            Send-Json $stream "200 OK" ('{"key":' + (ConvertTo-Json $key) + ',"value":' + $script:KV[$key] + '}')
          } else {
            Send-Json $stream "404 Not Found" ('{"key":' + (ConvertTo-Json $key) + ',"value":null}')
          }
        } elseif ($method -eq "PUT" -or $method -eq "POST") {
          try {
            $obj = $body | ConvertFrom-Json
            $valJson = $obj.value | ConvertTo-Json -Depth 30 -Compress
            $script:KV[$key] = $valJson
            Save-KV
            Send-Json $stream "200 OK" ('{"key":' + (ConvertTo-Json $key) + ',"ok":true}')
          } catch {
            Write-Host "[kv] PUT $key : $($_.Exception.Message)" -ForegroundColor Yellow
            Send-Json $stream "400 Bad Request" '{"error":"corps JSON invalide"}'
          }
        } else {
          Send-Json $stream "405 Method Not Allowed" '{"error":"methode non autorisee"}'
        }
        $client.Close(); continue
      }

      # ---- Fichiers statiques ----
      if ($urlPath -eq "/") { $urlPath = "/index.html" }
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $root ($urlPath.TrimStart('/') -replace '/', '\')))
      if ($filePath.StartsWith($root) -and (Test-Path $filePath -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $ctype = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
        Send-Response $stream "200 OK" $ctype ([System.IO.File]::ReadAllBytes($filePath))
      } else {
        Send-Response $stream "404 Not Found" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("404 - $urlPath"))
      }
    } catch {
      # connexion interrompue : on ignore
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
