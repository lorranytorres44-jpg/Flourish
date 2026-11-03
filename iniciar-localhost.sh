#!/usr/bin/env bash
# ======================================================================
#   🌸 FLOWRISH - SERVIDOR LOCALHOST :8080 (LINUX / macOS)
# ======================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================================"
echo "  🌸 FLOWRISH - PLATAFORMA DE TROCA DE LIVROS"
echo "======================================================================"
echo "  Iniciando servidor local na porta 8080..."
echo "  Pressione Ctrl + C para encerrar o servidor."
echo "======================================================================"
echo ""

# Tenta abrir o navegador em segundo plano se disponível
if command -v xdg-open >/dev/null 2>&1; then
    (sleep 1.2 && xdg-open "http://localhost:8080" >/dev/null 2>&1) &
elif command -v open >/dev/null 2>&1; then
    (sleep 1.2 && open "http://localhost:8080" >/dev/null 2>&1) &
fi

# Prioriza Node.js
if command -v node >/dev/null 2>&1; then
    echo "[OK] Node.js detectado ($(node -v)). Executando server.js..."
    echo "----------------------------------------------------------------------"
    echo " Servidor rodando em: http://localhost:8080"
    echo "----------------------------------------------------------------------"
    echo ""
    exec node server.js
elif command -v python3 >/dev/null 2>&1; then
    echo "[OK] Python 3 detectado. Executando server.py..."
    echo "----------------------------------------------------------------------"
    echo " Servidor rodando em: http://localhost:8080"
    echo "----------------------------------------------------------------------"
    echo ""
    exec python3 server.py
else
    echo "[ERRO] Nem Node.js nem Python 3 foram encontrados neste sistema."
    echo "Instale o Node.js: https://nodejs.org/"
    exit 1
fi
