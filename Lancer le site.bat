@echo off
REM Double-clique ce fichier pour lancer le site, puis ouvre http://localhost:5178
powershell -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
