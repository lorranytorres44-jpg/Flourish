@echo off
chcp 65001 > nul
title Flowrish - Servidor Localhost :8080

echo ======================================================================
echo   🌸 FLOWRISH - PLATAFORMA DE TROCA DE LIVROS
echo ======================================================================
echo   Iniciando servidor local na porta 8080...
echo   Esta janela do terminal deve permanecer aberta enquanto voce usa o site.
echo ======================================================================
echo.

cd /d "%~dp0"

:: Configura caminhos comuns para Node e Python caso nao estejam no PATH
if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Python\bin" set "PATH=%LOCALAPPDATA%\Python\bin;%PATH%"
if exist "%LOCALAPPDATA%\Programs\Python\Python312" set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%PATH%"

:: Abre o navegador no endereco do projeto
start http://localhost:8080

:: Prioriza Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Node.js detectado. Executando server.js...
    echo.
    echo ----------------------------------------------------------------------
    echo  Servidor rodando em: http://localhost:8080
    echo  Para encerrar o servidor, feche esta janela ou pressione Ctrl + C
    echo ----------------------------------------------------------------------
    echo.
    node server.js
    goto fim
)

:: Alternativa via Python
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Python detectado. Executando server.py...
    echo.
    echo ----------------------------------------------------------------------
    echo  Servidor rodando em: http://localhost:8080
    echo  Para encerrar o servidor, feche esta janela ou pressione Ctrl + C
    echo ----------------------------------------------------------------------
    echo.
    python server.py
    goto fim
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Python (py launcher) detectado. Executando server.py...
    echo.
    echo ----------------------------------------------------------------------
    echo  Servidor rodando em: http://localhost:8080
    echo  Para encerrar o servidor, feche esta janela ou pressione Ctrl + C
    echo ----------------------------------------------------------------------
    echo.
    py server.py
    goto fim
)

echo [ERRO] Nao foi possivel encontrar Node.js nem Python instalados nesta maquina.
echo Por favor, instale o Node.js em: https://nodejs.org/
echo.

:fim
echo.
echo Servidor finalizado.
pause

