#!/usr/bin/env bash
# Setup do agente Deck (T3, DR-023): clona/atualiza o repo, instala deps nativas
# (node-pty, better-sqlite3), pareia ao relay com o código e sobe o agente.
# O agente reusa o backend inteiro (serveConnection), por isso precisa do repo —
# não dá pra ser um npx fino sem publicar. A chave Ed25519 nasce e fica nesta box.
#
# Uso (a partir do Dashboard):
#   curl -fsSL https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh | bash -s -- CÓDIGO
#
# Variáveis (opcionais):
#   DECK_RELAY_URL    relay (default: wss://deck-relay.devfellowship.com)
#   DECK_AGENT_ROLE   admin = controle total nesta box (terminais/admin); default student
#   DECK_SRC_DIR      onde clonar (default: ~/.deck-src)
set -euo pipefail

CODE="${1:-}"
RELAY="${DECK_RELAY_URL:-wss://deck-relay.devfellowship.com}"
SRC_DIR="${DECK_SRC_DIR:-$HOME/.deck-src}"
REPO="https://github.com/SamuelStefano/cockpit.git"

command -v git >/dev/null  || { echo "[deck] git não encontrado — instale git"; exit 1; }
command -v node >/dev/null || { echo "[deck] node não encontrado — instale Node 20+"; exit 1; }

if [ -d "$SRC_DIR/.git" ]; then
  echo "[deck] atualizando repo em $SRC_DIR…"
  git -C "$SRC_DIR" pull --ff-only
else
  echo "[deck] clonando repo em $SRC_DIR…"
  git clone --depth 1 "$REPO" "$SRC_DIR"
fi

cd "$SRC_DIR"
echo "[deck] instalando dependências (pode compilar node-pty/better-sqlite3)…"
npm install

if [ -n "$CODE" ]; then
  echo "[deck] pareando ao relay…"
  DECK_RELAY_URL="$RELAY" npx tsx server/agent.ts --pair="$CODE"
fi

echo "[deck] subindo agente (role=${DECK_AGENT_ROLE:-student}) — a tela troca sozinha quando conectar."
exec env DECK_RELAY_URL="$RELAY" npx tsx server/agent.ts
