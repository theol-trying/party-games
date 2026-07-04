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
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"; ".mp3" = "audio/mpeg"; ".wav" = "audio/wav"; ".ico" = "image/x-icon"
}

function Send-Response($stream, $status, $ctype, [byte[]]$body) {
  $header = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
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
      if ($urlPath -like "/api/kv/*") {
        $key = $urlPath.Substring("/api/kv/".Length)
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
            Send-Json $stream "500 Internal Server Error" ('{"error":' + (ConvertTo-Json "$($_.Exception.Message)") + '}')
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
