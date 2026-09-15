@echo off
chcp 65001 > nul
echo ========================================================
echo   Flowrish - Sincronizacao com GitHub e Render
echo   Repositorio: https://github.com/lorranytorres44-jpg/Flourish
echo   Branch: MVP
echo ========================================================
echo.
cd /d "%~dp0"
echo Verificando arquivos modificados...
git status -s
echo.
git add .
set msg=
set /p msg="Mensagem do commit (pressione Enter para mensagem padrao): "
if "%msg%"=="" set msg=Atualizacoes no site Flowrish

git commit -m "%msg%"
echo.
echo Enviando para a branch MVP no GitHub...
git push -u origin MVP
echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo [SUCESSO] Codigo enviado para o GitHub com sucesso!
    echo O Render vai detectar as alteracoes e atualizar o site
    echo automaticamente em cerca de 1 a 2 minutos.
    echo ========================================================
) else (
    echo [ERRO] Ocorreu uma falha ao enviar para o GitHub.
)
pause
