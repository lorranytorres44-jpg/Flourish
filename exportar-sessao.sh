#!/usr/bin/env bash
# ======================================================================
#   🌸 FLOWRISH - EXPORTADOR DE SESSAO ANTIGRAVITY (LINUX / macOS)
# ======================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================================"
echo "  🌸 FLOURISH - EXPORTADOR DE SESSAO E HISTORICO ANTIGRAVITY"
echo "======================================================================"
echo "  Exportando projeto, conversas, logs de IA e documentos handover..."
echo "======================================================================"
echo ""

if command -v python3 >/dev/null 2>&1; then
    exec python3 tools/export/export_session.py "$@"
elif command -v python >/dev/null 2>&1; then
    exec python tools/export/export_session.py "$@"
else
    echo "[ERRO] Python 3 não foi encontrado no sistema."
    exit 1
fi
