@echo off
chcp 65001 > nul
title Flourish - Exportador de Sessao Antigravity

cd /d "%~dp0"
call tools\export\export_session.bat %*
