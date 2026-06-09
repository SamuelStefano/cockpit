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

# node-pty e better-sqlite3 são módulos nativos: quando não há prebuild para a ABI
# do Node instalado, o npm cai pro node-gyp, que exige make + compilador C/C++ +
# python3. Sem isso o install morre com "not found: make". Detecta e instala antes.
have_build_tools() {
  command -v make >/dev/null 2>&1 || return 1
  command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1 || command -v g++ >/dev/null 2>&1 || return 1
  command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || return 1
  return 0
}

install_build_tools() {
  local sudo=""
  if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 && sudo="sudo"
  fi
  if command -v apt-get >/dev/null 2>&1; then
    $sudo apt-get update -y && $sudo apt-get install -y build-essential python3
  elif command -v dnf >/dev/null 2>&1; then
    $sudo dnf groupinstall -y "Development Tools" && $sudo dnf install -y python3
  elif command -v yum >/dev/null 2>&1; then
    $sudo yum groupinstall -y "Development Tools" && $sudo yum install -y python3
  elif command -v apk >/dev/null 2>&1; then
    $sudo apk add --no-cache build-base python3
  elif command -v pacman >/dev/null 2>&1; then
    $sudo pacman -Sy --noconfirm base-devel python
  elif command -v zypper >/dev/null 2>&1; then
    $sudo zypper install -y -t pattern devel_basis && $sudo zypper install -y python3
  else
    return 1
  fi
}

if ! have_build_tools; then
  echo "[deck] ferramentas de build ausentes (make/compilador/python3) — necessárias p/ node-pty e better-sqlite3"
  echo "[deck] tentando instalar automaticamente…"
  if install_build_tools && have_build_tools; then
    echo "[deck] ferramentas de build instaladas."
  else
    cat <<'EOF'
[deck] não consegui instalar as ferramentas de build automaticamente.
Instale manualmente e rode o setup de novo:
  Debian/Ubuntu:  sudo apt-get install -y build-essential python3
  Fedora/RHEL:    sudo dnf groupinstall -y "Development Tools" && sudo dnf install -y python3
  Alpine:         sudo apk add build-base python3
  Arch:           sudo pacman -S base-devel python
EOF
    exit 1
  fi
fi

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
