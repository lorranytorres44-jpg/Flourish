@echo off
chcp 65001 > nul
echo ========================================================
echo   Iniciando Flowrish no Localhost (Porta 8080)
echo ========================================================
echo.
cd /d "%~dp0"
start http://localhost:8080
node server.js
pause
