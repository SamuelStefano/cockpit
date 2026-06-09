#!/usr/bin/env bash
# Setup do agente Deck (T3, DR-023): bootstrap completo numa VPS zerada — instala
# git, curl, Node 20+, build tools e o Claude CLI se faltarem, clona/atualiza o
# repo, instala as deps nativas (node-pty, better-sqlite3), pareia ao relay com o
# código e sobe o agente como serviço systemd (auto-restart, sobrevive a reboot;
# fallback nohup sem systemd). O agente reusa o backend inteiro (serveConnection),
# por isso precisa do repo — não dá pra ser um npx fino sem publicar. A chave
# Ed25519 nasce e fica nesta box.
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

# Bootstrap pra VPS zerada: instala TUDO que falta (git, curl, Node 20+, build
# tools, Claude CLI) antes de clonar/buildar. Funciona em Debian/Ubuntu, Fedora/
# RHEL, Alpine, Arch e openSUSE. Roda como root direto; senão usa sudo.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 && SUDO="sudo"
fi

# Instala pacotes "simples" (mesmo nome em toda distro): git, curl.
pm_install() {
  if command -v apt-get >/dev/null 2>&1; then $SUDO apt-get update -y && $SUDO apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1;   then $SUDO dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1;   then $SUDO yum install -y "$@"
  elif command -v apk >/dev/null 2>&1;   then $SUDO apk add --no-cache "$@"
  elif command -v pacman >/dev/null 2>&1;then $SUDO pacman -Sy --noconfirm "$@"
  elif command -v zypper >/dev/null 2>&1;then $SUDO zypper install -y "$@"
  else return 1; fi
}

ensure_cmd() { # ensure_cmd <comando> <pacote>
  command -v "$1" >/dev/null 2>&1 && return 0
  echo "[deck] instalando $2…"
  pm_install "$2" || { echo "[deck] não consegui instalar $2 automaticamente — instale manualmente e rode de novo"; exit 1; }
}

# git + curl (curl é necessário pro instalador do Node).
ensure_cmd curl curl
ensure_cmd git git

# Node 20+: se ausente ou velho, instala via NodeSource (apt/dnf), repo da distro
# (apk/pacman) ou nvm como último recurso.
node_major() { command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
install_node() {
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - && $SUDO apt-get install -y nodejs
  elif command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash - && pm_install nodejs
  elif command -v apk >/dev/null 2>&1 || command -v pacman >/dev/null 2>&1 || command -v zypper >/dev/null 2>&1; then
    pm_install nodejs npm
  else
    export NVM_DIR="$HOME/.nvm"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh" && nvm install 20 && nvm use 20
  fi
}
if [ "$(node_major)" -lt 20 ]; then
  echo "[deck] Node 20+ ausente — instalando…"
  install_node
  command -v node >/dev/null 2>&1 || { echo "[deck] falha ao instalar o Node — instale Node 20+ manualmente e rode de novo"; exit 1; }
  echo "[deck] Node $(node -v) instalado."
fi

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
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -y && $SUDO apt-get install -y build-essential python3
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf groupinstall -y "Development Tools" && $SUDO dnf install -y python3
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum groupinstall -y "Development Tools" && $SUDO yum install -y python3
  elif command -v apk >/dev/null 2>&1; then
    $SUDO apk add --no-cache build-base python3
  elif command -v pacman >/dev/null 2>&1; then
    $SUDO pacman -Sy --noconfirm base-devel python
  elif command -v zypper >/dev/null 2>&1; then
    $SUDO zypper install -y -t pattern devel_basis && $SUDO zypper install -y python3
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

# Claude Code CLI: o backend do agente roda `claude` por baixo. Instala global se faltar.
if ! command -v claude >/dev/null 2>&1; then
  echo "[deck] instalando Claude Code CLI…"
  npm install -g @anthropic-ai/claude-code 2>/dev/null \
    || $SUDO npm install -g @anthropic-ai/claude-code \
    || echo "[deck] aviso: não consegui instalar o Claude CLI global — faça 'npm i -g @anthropic-ai/claude-code' manualmente"
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

# Persistência: instala um serviço systemd pra o agente sobreviver ao fechamento
# do SSH e a reboots, com auto-restart. Sem systemd (ou sem root/sudo p/ escrever
# a unit), cai pro nohup — sobrevive ao SSH mas NÃO ao reboot.
SERVICE="deck-agent"
RUN_USER="$(id -un)"
NODE_BIN="$(dirname "$(command -v node)")"
NPX_BIN="$(command -v npx)"
ROLE="${DECK_AGENT_ROLE:-student}"

can_systemd() {
  command -v systemctl >/dev/null 2>&1 || return 1
  [ "$(id -u)" -eq 0 ] || [ -n "$SUDO" ] || return 1
  $SUDO systemctl list-units >/dev/null 2>&1 || return 1
  return 0
}

if can_systemd; then
  echo "[deck] instalando serviço systemd ($SERVICE) — auto-restart e sobrevive a reboot…"
  $SUDO tee "/etc/systemd/system/$SERVICE.service" >/dev/null <<EOF
[Unit]
Description=Deck Agent (T3 relay)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$SRC_DIR
Environment=HOME=$HOME
Environment=PATH=$NODE_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=DECK_RELAY_URL=$RELAY
Environment=DECK_AGENT_ROLE=$ROLE
ExecStart=$NPX_BIN tsx server/agent.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable "$SERVICE" >/dev/null 2>&1 || true
  $SUDO systemctl restart "$SERVICE"
  echo "[deck] agente rodando como serviço (role=$ROLE) — a tela troca sozinha quando conectar."
  echo "[deck] logs:    $SUDO journalctl -u $SERVICE -f"
  echo "[deck] parar:   $SUDO systemctl stop $SERVICE"
else
  echo "[deck] systemd indisponível — subindo com nohup (sobrevive ao SSH, NÃO a reboot)."
  cd "$SRC_DIR"
  nohup env DECK_RELAY_URL="$RELAY" DECK_AGENT_ROLE="$ROLE" npx tsx server/agent.ts \
    >"$SRC_DIR/agent.log" 2>&1 &
  echo "[deck] agente rodando (PID $!, role=$ROLE) — a tela troca sozinha quando conectar."
  echo "[deck] logs: tail -f $SRC_DIR/agent.log"
fi
