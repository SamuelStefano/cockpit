#!/usr/bin/env bash
# Setup do agente Deck (T3, DR-023): clona/atualiza o repo, instala as deps nativas
# (node-pty, better-sqlite3), pareia ao relay com o código e sobe o agente como
# serviço systemd (auto-restart, sobrevive a reboot; fallback nohup sem systemd).
# O agente reusa o backend inteiro (serveConnection), por isso precisa do repo —
# não dá pra ser um npx fino sem publicar. A chave Ed25519 nasce e fica nesta box.
#
# Política: REAPROVEITAR o que a box já tem. Usa o Node 20+ que já existe (PATH, nvm
# ou um anterior em ~/.deck-node) e o `claude` que já existe; só instala o que
# faltar, e sempre dentro do seu HOME (Node em ~/.deck-node, claude em ~/.deck-npm).
# Nunca troca o Node do sistema, nunca faz npm global, e o único sudo é a unit
# systemd. Ferramentas de build só se o `npm ci` falhar sem elas (e com opt-in).
# git/curl ausentes são instalados pelo gerenciador de pacotes (não quebra nada).
#
# Este script é um curl|bash rodado na VPS de OUTRA pessoa: o default tem que ser
# o mínimo (agente e mais nada). Tudo que mexe na máquina além disso — watchdog que
# mata processo, cron, hook de git que reinicia serviço — é OPT-IN por variável.
#
# Uso (a partir do Dashboard):
#   curl -fsSL https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh | DECK_PAIR_CODE=CÓDIGO bash
#   (env, not argv: `bash -s -- CÓDIGO` leaves the code visible in `ps` for the whole install)
#
# Requer `claude` LOGADO nesta box: se nunca logou, rode `claude` uma vez e depois
# reinicie o serviço (o script avisa no fim).
#
# Variáveis (opcionais):
#   DECK_RELAY_URL     relay (default: wss://deck-relay.devfellowship.com)
#   DECK_AGENT_ROLE    admin = controle total nesta box (terminais/admin); default student
#   DECK_SRC_DIR       onde clonar (default: ~/.deck-src)
#   DECK_PAIR_CODE     código de pareamento por env (o argv aparece no `ps` da box)
#   DECK_ALLOW_ROOT=1  permite rodar como root (default: recusa — o agente herdaria root)
#   DECK_VPS_GUARD=1   instala o watchdog anti-travamento (MATA processos; leia o aviso)
#   DECK_AUTO_REDEPLOY=1  arma os git hooks que reiniciam backend/agente a cada pull
#   DECK_EXTRAS=1      instala os crons extras (hibernação de sessões, triador de incidentes)
#   DECK_DRY_RUN=1     só detecta e imprime o plano (reaproveita/instalaria); não instala nada
#   DECK_INSTALL_BUILD_TOOLS=1  se o `npm ci` falhar sem make/compilador/python3, instala
#                      (sudo + gerenciador de pacotes) e tenta de novo; default: só mostra o comando
#   DECK_SKIP_INSTALL=1   pula o `npm ci` (só pra testar o instalador; o agente NÃO sobe)
set -euo pipefail
# Este script cria chave privada (identity.json), log de agente e clone do repo.
# Default restritivo; installs no HOME do próprio usuário funcionam com 077.
umask 077

CODE="${1:-}"
if [ -z "$CODE" ]; then CODE="${DECK_PAIR_CODE:-}"; fi
RELAY="${DECK_RELAY_URL:-wss://deck-relay.devfellowship.com}"
SRC_DIR="${DECK_SRC_DIR:-$HOME/.deck-src}"
AGENT_DIR="${DECK_AGENT_DIR:-$HOME/.deck-agent}"
REPO="https://github.com/SamuelStefano/cockpit.git"
SETUP_URL="https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh"

# Root vira User=root na unit systemd: o agente roda `claude -p` e terminais reais,
# então todo turno passaria a ter root na box do fellow. Recusa por default.
if [ "$(id -u)" -eq 0 ] && [ "${DECK_ALLOW_ROOT:-}" != "1" ]; then
  cat <<EOF
[deck] recusando instalar como root.
O agente executa comandos (claude -p, terminais) com o usuário que o instalou —
como root, qualquer turno vira root nesta máquina.

Crie um usuário normal com sudo (defina a senha: o sudo vai pedir) e rode de novo:
  adduser --gecos "" deck
  usermod -aG sudo deck      # (Debian/Ubuntu; em RHEL/Fedora o grupo é 'wheel')
  su - deck
  curl -fsSL $SETUP_URL | DECK_PAIR_CODE=CÓDIGO bash

Se você REALMENTE quer o agente como root, rode de novo com DECK_ALLOW_ROOT=1.
EOF
  exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
fi
DRY="${DECK_DRY_RUN:-}"
DECK_NODE_DIR="$HOME/.deck-node"
DECK_NPM_DIR="$HOME/.deck-npm"
REUSED=""; INSTALLED=""
note_reused() { REUSED="${REUSED:+$REUSED, }$1"; }
note_installed() { INSTALLED="${INSTALLED:+$INSTALLED, }$1"; }

# Instala pacotes "simples" (mesmo nome em toda distro): git, curl.
pm_install() {
  ( umask 022
  if command -v apt-get >/dev/null 2>&1; then $SUDO apt-get update -y && $SUDO apt-get install -y "$@"
  elif command -v dnf >/dev/null 2>&1;   then $SUDO dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1;   then $SUDO yum install -y "$@"
  elif command -v apk >/dev/null 2>&1;   then $SUDO apk add --no-cache "$@"
  elif command -v pacman >/dev/null 2>&1;then $SUDO pacman -Sy --noconfirm "$@"
  elif command -v zypper >/dev/null 2>&1;then $SUDO zypper install -y "$@"
  else return 1; fi
  )
}

ensure_cmd() { # ensure_cmd <comando> <pacote>
  command -v "$1" >/dev/null 2>&1 && return 0
  echo "[deck] instalando $2…"
  pm_install "$2" || { echo "[deck] não consegui instalar $2 automaticamente — instale manualmente e rode de novo"; exit 1; }
}

have_build_tools() {
  command -v make >/dev/null 2>&1 || return 1
  command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1 || command -v g++ >/dev/null 2>&1 || return 1
  command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || return 1
  return 0
}

# Só roda com DECK_INSTALL_BUILD_TOOLS=1 e depois de um `npm ci` que falhou.
install_build_tools() {
  ( umask 022
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
  )
}

# Escolhe o primeiro Node >= 20: PATH, nvm (maior versão), ~/.deck-node. Sem nenhum,
# baixa o tarball oficial pro ~/.deck-node (não mexe no Node do sistema).
# Define NODE_DIR, NODE_VER e NODE_HOW (reuse|install); com DECK_DRY_RUN=1 não baixa.
pick_node() {
  local p v c best
  nodever() { "$1" -p 'process.versions.node' 2>/dev/null || echo 0; }
  NODE_DIR=""; NODE_VER=""; NODE_HOW="reuse"
  if p="$(command -v node 2>/dev/null)"; then
    v="$(nodever "$p")"
    if [ "${v%%.*}" -ge 20 ] 2>/dev/null; then NODE_DIR="$(dirname "$p")"; NODE_VER="$v"; return 0; fi
  fi
  best=""
  for c in "${NVM_DIR:-$HOME/.nvm}"/versions/node/*/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
    [ -x "$c" ] || continue
    v="$(nodever "$c")"
    [ "${v%%.*}" -ge 20 ] 2>/dev/null || continue
    best="$best$v $c"$'\n'
  done
  if [ -n "$best" ]; then
    best="$(printf '%s' "$best" | sort -V | tail -n 1)"
    NODE_VER="${best%% *}"; NODE_DIR="$(dirname "${best#* }")"; return 0
  fi
  c="$HOME/.deck-node/bin/node"
  if [ -x "$c" ]; then
    v="$(nodever "$c")"
    if [ "${v%%.*}" -ge 20 ] 2>/dev/null; then NODE_DIR="$HOME/.deck-node/bin"; NODE_VER="$v"; return 0; fi
  fi
  NODE_HOW="install"; NODE_DIR="$HOME/.deck-node/bin"; NODE_VER="20 LTS"
  [ "${DECK_DRY_RUN:-}" = "1" ] && return 0
  local arch base file tmp
  case "$(uname -m)" in
    x86_64|amd64) arch=x64;;
    aarch64|arm64) arch=arm64;;
    *) echo "[deck] arquitetura $(uname -m) sem Node oficial automático — instale Node 20+ e rode de novo"; exit 1;;
  esac
  base="https://nodejs.org/dist/latest-v20.x"
  tmp="$(mktemp -d)"
  echo "[deck] Node 20+ não encontrado — baixando o Node 20 LTS oficial pra $HOME/.deck-node (não mexe no Node do sistema)…"
  curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" || { echo "[deck] falha ao baixar SHASUMS256.txt"; rm -rf "$tmp"; exit 1; }
  file="$(grep -o "node-v[0-9.]*-linux-$arch\.tar\.gz" "$tmp/SHASUMS256.txt" | head -n 1)"
  [ -n "$file" ] || { echo "[deck] tarball linux-$arch não listado em SHASUMS256.txt"; rm -rf "$tmp"; exit 1; }
  curl -fsSL "$base/$file" -o "$tmp/$file" || { echo "[deck] falha ao baixar $file"; rm -rf "$tmp"; exit 1; }
  ( cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum -c - >/dev/null ) || { echo "[deck] checksum do $file não confere — abortando"; rm -rf "$tmp"; exit 1; }
  rm -rf "$HOME/.deck-node"
  mkdir -p "$HOME/.deck-node"
  tar -xzf "$tmp/$file" -C "$HOME/.deck-node" --strip-components=1
  rm -rf "$tmp"
  NODE_VER="${file#node-}"; NODE_VER="${NODE_VER%%-linux*}"
}

# Reaproveita um `claude` existente: PATH, ~/.local/bin, ~/.claude/local, ~/.deck-npm.
# Define CLAUDE_BIN (vazio se ausente).
find_claude() {
  local c
  CLAUDE_BIN=""
  if c="$(command -v claude 2>/dev/null)"; then CLAUDE_BIN="$c"; return 0; fi
  for c in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude" "$HOME/.deck-npm/bin/claude"; do
    if [ -x "$c" ]; then CLAUDE_BIN="$c"; return 0; fi
  done
  return 0
}

print_summary() {
  echo "[deck] resumo — reaproveitado: ${REUSED:-nada}; instalado: ${INSTALLED:-nada}."
}

if [ "$DRY" = "1" ]; then
  echo "[deck] DECK_DRY_RUN=1 — só detecção, nada será instalado. Plano:"
  for t in git curl; do
    if command -v "$t" >/dev/null 2>&1; then echo "  $t: reaproveita $(command -v "$t")"
    else echo "  $t: instalaria $t via gerenciador de pacotes (sudo) em /usr"; fi
  done
  pick_node
  if [ "$NODE_HOW" = "reuse" ]; then echo "  node: reaproveita $NODE_DIR/node (v$NODE_VER)"
  else echo "  node: instalaria Node 20 LTS (tarball oficial nodejs.org) em $HOME/.deck-node"; fi
  if have_build_tools; then echo "  build tools: reaproveita (make/compilador/python3 presentes)"
  else echo "  build tools: não instalaria de início; só se o npm ci falhar e DECK_INSTALL_BUILD_TOOLS=1"; fi
  find_claude
  if [ -n "$CLAUDE_BIN" ]; then echo "  claude: reaproveita $CLAUDE_BIN"
  else echo "  claude: instalaria @anthropic-ai/claude-code em $HOME/.deck-npm (npm --prefix, sem sudo)"; fi
  if command -v systemctl >/dev/null 2>&1; then
    if [ -f "/etc/systemd/system/deck-agent.service" ]; then echo "  systemd unit: reaproveita o nome (atualiza /etc/systemd/system/deck-agent.service, backup .bak)"
    else echo "  systemd unit: instalaria /etc/systemd/system/deck-agent.service (único uso de sudo)"; fi
  else
    echo "  systemd unit: systemd ausente — subiria com nohup"
  fi
  exit 0
fi

# git + curl (curl é necessário pro download do Node).
if command -v curl >/dev/null 2>&1; then note_reused curl; else ensure_cmd curl curl; note_installed curl; fi
if command -v git >/dev/null 2>&1; then note_reused git; else ensure_cmd git git; note_installed git; fi

pick_node
export PATH="$NODE_DIR:$PATH"
hash -r 2>/dev/null || true
if [ "$NODE_HOW" = "install" ]; then
  note_installed "node $NODE_VER ($HOME/.deck-node)"
else
  note_reused "node v$NODE_VER ($NODE_DIR)"
fi
echo "[deck] Node: $NODE_DIR/node (v$NODE_VER)"

# Claude Code CLI: o backend do agente roda `claude` por baixo. Sem ele nenhum turno
# executa — falha aqui é FATAL. Instala só em ~/.deck-npm, nunca global.
find_claude
if [ -z "$CLAUDE_BIN" ]; then
  echo "[deck] instalando Claude Code CLI em $DECK_NPM_DIR…"
  npm install -g --prefix "$DECK_NPM_DIR" @anthropic-ai/claude-code >/dev/null 2>&1 || true
  hash -r 2>/dev/null || true
  find_claude
  if [ -z "$CLAUDE_BIN" ]; then
    cat <<'EOF'
[deck] não consegui instalar o Claude CLI e o agente não roda sem ele.
Instale manualmente e rode o setup de novo:
  npm install -g --prefix "$HOME/.deck-npm" @anthropic-ai/claude-code
EOF
    exit 1
  fi
  note_installed "claude ($DECK_NPM_DIR)"
else
  note_reused "claude ($CLAUDE_BIN)"
fi
CLAUDE_DIR="$(dirname "$CLAUDE_BIN")"
export PATH="$CLAUDE_DIR:$PATH"

if [ -d "$SRC_DIR/.git" ]; then
  echo "[deck] atualizando repo em $SRC_DIR…"
  git -C "$SRC_DIR" pull --ff-only
else
  echo "[deck] clonando repo em $SRC_DIR…"
  git clone --depth 1 "$REPO" "$SRC_DIR"
fi

# node-pty/better-sqlite3 costumam ter prebuild; só se o npm falhar e faltarem
# make/compilador/python3 é que isso vira problema.
npm_deps() {
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
}

cd "$SRC_DIR"
if [ "${DECK_SKIP_INSTALL:-}" = "1" ]; then
  echo "[deck] DECK_SKIP_INSTALL=1 — pulando o npm ci (o agente NÃO vai subir; isto é modo de teste do instalador)."
else
  echo "[deck] instalando dependências com npm ci (prebuilds primeiro; compila só se precisar)…"
  if ! npm_deps; then
    if have_build_tools; then
      echo "[deck] npm ci falhou (as ferramentas de build já existem; veja o erro acima)."
      exit 1
    elif [ "${DECK_INSTALL_BUILD_TOOLS:-}" = "1" ]; then
      echo "[deck] npm ci falhou sem ferramentas de build — instalando (DECK_INSTALL_BUILD_TOOLS=1)…"
      install_build_tools && have_build_tools || { echo "[deck] não consegui instalar as ferramentas de build."; exit 1; }
      note_installed "build tools"
      npm_deps || exit 1
    else
      cat <<'EOF'
[deck] npm ci falhou e faltam ferramentas de build (make/compilador/python3), necessárias
p/ compilar node-pty e better-sqlite3 nesta plataforma. Instale e rode o setup de novo:
  Debian/Ubuntu:  sudo apt-get install -y build-essential python3
  Fedora/RHEL:    sudo dnf groupinstall -y "Development Tools" && sudo dnf install -y python3
  Alpine:         sudo apk add build-base python3
  Arch:           sudo pacman -S base-devel python
Ou rode de novo com DECK_INSTALL_BUILD_TOOLS=1 para instalar automaticamente (usa sudo).
EOF
      exit 1
    fi
  fi
fi

# Auto-redeploy: hooks que reiniciam backend+agente quando o main muda tocando
# server/. É opt-in porque arma execução de script a cada `git pull` neste clone —
# um pull passa a matar processo e subir código novo sem ninguém pedir.
if [ "${DECK_AUTO_REDEPLOY:-}" = "1" ]; then
  git config core.hooksPath scripts/git-hooks 2>/dev/null || true
  echo "[deck] auto-redeploy ARMADO: todo git pull neste clone que tocar server/ reinicia backend+agente."
else
  git config --unset core.hooksPath 2>/dev/null || true
  echo "[deck] auto-redeploy desligado (default) — atualize com: cd $SRC_DIR && git pull && sudo systemctl restart deck-agent"
fi

if [ -n "$CODE" ]; then
  echo "[deck] pareando ao relay…"
  # Código por env, não por argv: `ps aux` da box mostraria o código de pareamento
  # pra qualquer usuário local enquanto o pairing roda.
  if ! DECK_RELAY_URL="$RELAY" DECK_PAIR_CODE="$CODE" npx tsx server/agent.ts --pair; then
    echo "[deck] pareamento falhou (código inválido/expirado ou relay inacessível)."
    if [ ! -f "$AGENT_DIR/identity.json" ]; then
      echo "[deck] gere um código novo no Deck e rode de novo."
      exit 1
    fi
    echo "[deck] seguindo com a identidade que já existia em $AGENT_DIR."
  fi
fi

SERVICE="deck-agent"
RUN_USER="$(id -un)"
NODE_BIN="$NODE_DIR"
NPX_BIN="$(command -v npx)"
FLOCK_BIN="$(command -v flock || true)"
LOCK=/tmp/deck-agent.lock
ROLE="${DECK_AGENT_ROLE:-student}"
UNIT_PATH="$NODE_BIN:$CLAUDE_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Login do Claude nesta box — mesma regra do claudeReady() em server/admin-ops.ts.
# Sem isto o agente conecta, a UI acende e TODO prompt morre mudo: é o buraco que
# mais queimou fellow ("instalei e não responde").
claude_logged_in() {
  if [ -n "${ANTHROPIC_API_KEY:-}" ] || [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ]; then return 0; fi
  if [ -s "$HOME/.config/anthropic/credentials" ]; then return 0; fi
  node -e 'const fs=require("fs");try{const o=JSON.parse(fs.readFileSync(process.env.HOME+"/.claude/.credentials.json","utf8")).claudeAiOauth;process.exit(o&&typeof o.accessToken==="string"&&o.accessToken?0:1)}catch(e){process.exit(1)}' 2>/dev/null
}

LOGGED_IN=1
if ! claude_logged_in; then
  LOGGED_IN=0
  cat <<'EOF'

  ┌───────────────────────────────────────────────────────────────┐
  │  ATENÇÃO: o `claude` NÃO está logado nesta máquina.           │
  │  O agente sobe, mas TODO prompt vai falhar até você logar.    │
  │                                                               │
  │  Rode `claude` uma vez nesta box, faça o login, e depois:     │
  │      sudo systemctl restart deck-agent                        │
  └───────────────────────────────────────────────────────────────┘

EOF
fi

# Sem identidade o agente sai 1 na hora (runAgent aborta) e a unit ficaria
# respawnando pra sempre. Não instala nada: só ensina a parear.
if [ ! -f "$AGENT_DIR/identity.json" ]; then
  cat <<EOF
[deck] esta box ainda não está pareada — não vou subir o agente (ele sairia em loop).
Gere um código na tela "conectar sua VPS" do Deck e rode:
  curl -fsSL $SETUP_URL | DECK_PAIR_CODE=CÓDIGO bash
ou, com o repo já clonado aqui:
  cd $SRC_DIR && DECK_RELAY_URL=$RELAY DECK_PAIR_CODE=CÓDIGO npx tsx server/agent.ts --pair
EOF
  print_summary
  exit 0
fi

if [ "${DECK_SKIP_INSTALL:-}" = "1" ]; then
  print_summary
  echo "[deck] DECK_SKIP_INSTALL=1 — não subo o agente sem as deps instaladas. Rode de novo sem a variável."
  exit 0
fi

# Persistência: instala um serviço systemd pra o agente sobreviver ao fechamento
# do SSH e a reboots, com auto-restart. Sem systemd (ou sem root/sudo p/ escrever
# a unit), cai pro nohup — sobrevive ao SSH mas NÃO ao reboot.
can_systemd() {
  command -v systemctl >/dev/null 2>&1 || return 1
  [ "$(id -u)" -eq 0 ] || [ -n "$SUDO" ] || return 1
  $SUDO systemctl list-units >/dev/null 2>&1 || return 1
  return 0
}

# Nunca sobrescreve unit existente sem cópia: a box pode ter uma unit ajustada na mão.
write_unit() { # write_unit <caminho>  (conteúdo via stdin)
  local path="$1"
  if [ -f "$path" ]; then
    $SUDO cp -a "$path" "$path.bak"
    echo "[deck] backup da unit anterior em $path.bak"
  fi
  $SUDO tee "$path" >/dev/null
  $SUDO chmod 0644 "$path"
}

# flock: dois agentes com a MESMA identidade brigam pelo agentId no relay (um chuta
# o outro em loop). run-agent.sh já usa /tmp/deck-agent.lock — o serviço entra no
# mesmo lock pra nunca coexistir com o supervisor manual.
if [ -n "$FLOCK_BIN" ]; then
  EXEC_START="$FLOCK_BIN -n $LOCK $NPX_BIN tsx server/agent.ts"
else
  echo "[deck] aviso: 'flock' não encontrado — sem trava de instância única (não rode outro agente com a mesma identidade)."
  EXEC_START="$NPX_BIN tsx server/agent.ts"
fi

if can_systemd; then
  echo "[deck] instalando serviço systemd ($SERVICE) — auto-restart e sobrevive a reboot…"
  write_unit "/etc/systemd/system/$SERVICE.service" <<EOF
[Unit]
Description=Deck Agent (T3 relay)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$SRC_DIR
Environment=HOME=$HOME
Environment=PATH=$UNIT_PATH
Environment=DECK_RELAY_URL=$RELAY
Environment=DECK_AGENT_ROLE=$ROLE
Environment=DECK_AGENT_DIR=$AGENT_DIR
ExecStart=$EXEC_START
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable "$SERVICE" >/dev/null 2>&1 || true
  $SUDO systemctl restart "$SERVICE"
  echo "[deck] agente instalado como serviço (usuário=$RUN_USER, role=$ROLE)."
  echo "[deck] logs:    $SUDO journalctl -u $SERVICE -f"
  echo "[deck] parar:   $SUDO systemctl stop $SERVICE"
else
  echo "[deck] systemd indisponível — subindo com nohup (sobrevive ao SSH, NÃO a reboot)."
  cd "$SRC_DIR"
  # O log carrega saída de turno (prompt, caminhos, eventualmente segredo do env): 0600.
  touch "$SRC_DIR/agent.log" && chmod 600 "$SRC_DIR/agent.log"
  # shellcheck disable=SC2086
  nohup env DECK_RELAY_URL="$RELAY" DECK_AGENT_ROLE="$ROLE" DECK_AGENT_DIR="$AGENT_DIR" \
    $EXEC_START >>"$SRC_DIR/agent.log" 2>&1 &
  echo "[deck] agente rodando (PID $!, usuário=$RUN_USER, role=$ROLE)."
  echo "[deck] logs: tail -f $SRC_DIR/agent.log"
fi

# Watchdog anti-travamento (vps-guard.sh, a cada 3 min): se a box travar de load
# (thrash de swap/I/O — aconteceu em 2026-06-11, load 130), mata os vilões de CPU
# e escala pra matar o tmux se persistir. É AGRESSIVO e por isso opt-in: roda como
# $RUN_USER (não root), então só alcança processo do próprio usuário.
GUARD="$SRC_DIR/scripts/vps-guard.sh"

# Cron: drop-in em /etc/cron.d quando dá pra usar sudo (não encosta no crontab do
# fellow). Sem sudo, edita o crontab do usuário — com backup e ABORTANDO se o
# `crontab -l` falhar: o padrão antigo (`crontab -l | grep -v … | crontab -`)
# APAGA o crontab inteiro quando a leitura falha por qualquer motivo transitório.
install_cron_job() { # install_cron_job <nome> <spec cron> <comando>
  local name="$1" spec="$2" cmd="$3"
  if [ -n "$SUDO" ] || [ "$(id -u)" -eq 0 ]; then
    printf 'SHELL=/bin/bash\nPATH=%s\n%s %s %s\n' "$UNIT_PATH" "$spec" "$RUN_USER" "$cmd" \
      | $SUDO tee "/etc/cron.d/$name" >/dev/null
    $SUDO chmod 0644 "/etc/cron.d/$name"
    echo "[deck] cron instalado em /etc/cron.d/$name (usuário=$RUN_USER)"
    return 0
  fi
  command -v crontab >/dev/null 2>&1 || { echo "[deck] aviso: sem sudo e sem crontab — $name NÃO instalado."; return 1; }
  local err rc=0 cur
  err="$(mktemp)"
  cur="$(crontab -l 2>"$err")" || rc=$?
  if [ "$rc" -ne 0 ] && ! grep -qi 'no crontab' "$err"; then
    echo "[deck] 'crontab -l' falhou (rc=$rc) — NÃO vou reescrever seu crontab: $(cat "$err")"
    rm -f "$err"
    return 1
  fi
  rm -f "$err"
  printf '%s\n' "$cur" >"$HOME/.deck-crontab.bak"
  { printf '%s\n' "$cur" | grep -v "# $name" || true; echo "$spec $cmd # $name"; } | crontab -
  echo "[deck] cron instalado no crontab de $RUN_USER (backup em ~/.deck-crontab.bak)"
}

if [ "${DECK_VPS_GUARD:-}" = "1" ]; then
  cat <<EOF
[deck] instalando o watchdog anti-travamento (opt-in). Ele roda a cada 3 min como
       $RUN_USER e, sob load alto, MATA os processos de maior CPU (exceto infra/ssh/
       claude/agente) e derruba as suas sessões tmux. Log em /tmp/vps-guard.log.
EOF
  chmod +x "$GUARD" 2>/dev/null || true
  if can_systemd; then
    write_unit /etc/systemd/system/deck-vps-guard.service <<EOF
[Unit]
Description=Deck VPS guard (anti-freeze watchdog)

[Service]
Type=oneshot
User=$RUN_USER
ExecStart=/usr/bin/env bash "$GUARD"
EOF
    write_unit /etc/systemd/system/deck-vps-guard.timer <<EOF
[Unit]
Description=Roda o Deck VPS guard a cada 3 minutos

[Timer]
OnBootSec=2min
OnUnitActiveSec=3min

[Install]
WantedBy=timers.target
EOF
    $SUDO systemctl daemon-reload
    $SUDO systemctl enable --now deck-vps-guard.timer >/dev/null 2>&1 || true
    echo "[deck] watchdog ativo (systemd timer) — log em /tmp/vps-guard.log"
  else
    install_cron_job deck-vps-guard '*/3 * * * *' "/usr/bin/env bash \"$GUARD\" >/dev/null 2>&1" || true
  fi
else
  echo "[deck] watchdog anti-travamento NÃO instalado (opt-in: DECK_VPS_GUARD=1 — ele mata processos sob load alto)."
fi

# Extras de manutenção da box do Samuel: hibernação de sessões Claude ociosas (>24h,
# libera RAM e retoma com `claude --resume`) e triador de incidentes por IA (gasta
# token quando um turno falha). Nada disso é necessário pro agente funcionar.
if [ "${DECK_EXTRAS:-}" = "1" ]; then
  install_cron_job deck-hibernate '17 * * * *' "HIBERNATE_HOURS=24 /usr/bin/env bash \"$SRC_DIR/scripts/hibernate-idle.sh\" >/dev/null 2>&1" || true
  install_cron_job deck-incident-ai '*/15 * * * *' "/usr/bin/env bash \"$SRC_DIR/scripts/incident-ai.sh\" >/dev/null 2>&1" || true
  echo "[deck] extras ativos: hibernação de sessões ociosas e triador de incidentes."
else
  echo "[deck] extras (hibernação de sessões, triador de incidentes) não instalados — opt-in: DECK_EXTRAS=1."
fi

print_summary
if [ "$LOGGED_IN" = "1" ]; then
  echo "[deck] pronto — a tela do Deck troca sozinha quando o agente conectar."
else
  echo "[deck] pronto, MAS o \`claude\` não está logado: rode \`claude\` nesta box, faça login e depois '$SUDO systemctl restart $SERVICE' (ou reinicie o agente)."
fi
