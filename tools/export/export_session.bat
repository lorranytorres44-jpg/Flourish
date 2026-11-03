@echo off
chcp 65001 > nul
title Flourish - Exportador de Sessao Antigravity

echo ======================================================================
echo   🌸 FLOURISH - EXPORTADOR DE SESSAO E HISTORICO ANTIGRAVITY
echo ======================================================================
echo   Exportando projeto, conversas, logs de IA e documentos handover...
echo ======================================================================
echo.

cd /d "%~dp0..\.."

:: Configura caminhos conhecidos do Python se nao estiver no PATH
if exist "%LOCALAPPDATA%\Python\bin" set "PATH=%LOCALAPPDATA%\Python\bin;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python312" set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%PATH%"
if exist "C:\Python312" set "PATH=C:\Python312;%PATH%"
if exist "C:\Python311" set "PATH=C:\Python311;%PATH%"

where python >nul 2>nul
if %errorlevel% equ 0 (
    python tools\export\export_session.py %*
    goto fim
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    py tools\export\export_session.py %*
    goto fim
)

echo [ERRO] Python nao foi encontrado no sistema.
echo Por favor, instale o Python ou adicione ao PATH.
echo.

:fim
echo.
pause
