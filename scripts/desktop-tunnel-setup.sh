#!/usr/bin/env bash
# Installer do túnel on-demand — roda no DESKTOP do Samuel (Linux/macOS/WSL). Gera a
# chave dedicada, grava a config, baixa o daemon e o sobe como serviço (systemd --user
# no Linux, launchd no macOS, nohup como fallback). Ao final imprime a LINHA pra colar
# em ~/.ssh/authorized_keys da VPS. Plano: 20260626-deck-on-demand-tunnels.
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/desktop-tunnel-setup.sh | bash
# Vars (opcionais): VPS_HOST, VPS_USER, POLL_SEC, DAEMON_URL, BRANCH
set -euo pipefail

DIR="$HOME/.deck-tunnel"
KEY="$DIR/id_ed25519"
DAEMON="$DIR/deck-tunnel-daemon.py"
BRANCH="${BRANCH:-main}"
DAEMON_URL="${DAEMON_URL:-https://raw.githubusercontent.com/SamuelStefano/cockpit/$BRANCH/scripts/deck-tunnel-daemon.py}"

mkdir -p "$DIR"; chmod 700 "$DIR"

command -v ssh >/dev/null 2>&1   || { echo "[deck] cliente OpenSSH ausente — instale e rode de novo"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "[deck] python3 ausente — instale e rode de novo"; exit 1; }

# Chave dedicada (não reusa a chave pessoal): ela será travada na VPS por forced-command.
if [ ! -f "$KEY" ]; then
  echo "[deck] gerando chave ed25519 dedicada…"
  ssh-keygen -t ed25519 -N "" -C "deck-tunnel-desktop" -f "$KEY" >/dev/null
fi
chmod 600 "$KEY"

# Config (prompts com default; respeita env se já setado e sem TTY).
ask() { local var="$1" def="$2" cur="${!1:-}"; if [ -n "$cur" ]; then echo "$cur"; return; fi
  if [ -t 0 ]; then read -rp "$var [$def]: " a; echo "${a:-$def}"; else echo "$def"; fi; }
VPS_HOST="$(ask VPS_HOST 89.167.66.196)"
VPS_USER="$(ask VPS_USER samuel)"
POLL_SEC="$(ask POLL_SEC 3)"
cat > "$DIR/config" <<EOF
VPS_HOST=$VPS_HOST
VPS_USER=$VPS_USER
POLL_SEC=$POLL_SEC
KEY=$KEY
EOF
chmod 600 "$DIR/config"

# Daemon: copia do clone local se existir; senão baixa.
SELF_DAEMON="$(dirname "$0")/deck-tunnel-daemon.py"
if [ -f "$SELF_DAEMON" ]; then cp "$SELF_DAEMON" "$DAEMON"
else echo "[deck] baixando daemon…"; curl -fsSL "$DAEMON_URL" -o "$DAEMON"; fi
chmod +x "$DAEMON"

# Serviço: systemd --user (Linux) > launchd (macOS) > nohup.
PY="$(command -v python3)"
install_service() {
  local os; os="$(uname -s)"
  if [ "$os" = "Linux" ] && command -v systemctl >/dev/null 2>&1 && systemctl --user >/dev/null 2>&1; then
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/deck-tunnel-daemon.service" <<EOF
[Unit]
Description=Deck tunnel daemon (on-demand reverse tunnels)
After=network-online.target

[Service]
ExecStart=$PY $DAEMON
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload
    systemctl --user enable --now deck-tunnel-daemon.service
    command -v loginctl >/dev/null 2>&1 && loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || true
    echo "[deck] serviço systemd --user ativo. logs: journalctl --user -u deck-tunnel-daemon -f"
  elif [ "$os" = "Darwin" ]; then
    local plist="$HOME/Library/LaunchAgents/com.deck.tunnel-daemon.plist"
    cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.deck.tunnel-daemon</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>$DAEMON</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>$DIR/daemon.log</string>
</dict></plist>
EOF
    launchctl unload "$plist" >/dev/null 2>&1 || true
    launchctl load "$plist"
    echo "[deck] serviço launchd ativo. logs: $DIR/daemon.log"
  else
    nohup "$PY" "$DAEMON" >"$DIR/daemon.log" 2>&1 &
    echo "[deck] sem systemd/launchd — rodando via nohup (PID $!). NÃO sobrevive a reboot."
  fi
}
install_service

PUB="$(cat "$KEY.pub")"
cat <<EOF

============================================================
[deck] FALTA 1 PASSO — cole esta linha na VPS, em
       ~/.ssh/authorized_keys do usuário '$VPS_USER':
------------------------------------------------------------
restrict,permitlisten="127.0.0.1:*",command="/home/$VPS_USER/.local/bin/deck-tunnel relay" $PUB
------------------------------------------------------------
Depois disso, na VPS:  deck-tunnel request obsidian
============================================================
EOF
