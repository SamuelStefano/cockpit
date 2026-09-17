#!/usr/bin/env bash
# Rebota os SUPERVISORES (run-backend.sh / run-agent.sh), não só o inner.
#
# redeploy.sh mata só o inner de propósito — é o suficiente pra código novo. Mas o
# ambiente vem do supervisor, e ele vive meses: em 16/09/2026 o supervisor do agente
# tinha 68 dias e nunca tinha visto o COCKPIT_MAX_COLD_INFLIGHT=0 escrito no
# ~/.cockpit-local.env no mesmo dia. Depois do fix que passou o `source` pra dentro do
# loop, este script é o que só precisa rodar UMA vez — a partir daí o redeploy normal
# já recarrega o env.
#
# Uso: setsid nohup bash scripts/restart-supervisors.sh >/dev/null 2>&1 &
# Rebotar mata todo `claude -p` em voo, inclusive o turno que disparou — por isso
# espera a box ficar ociosa antes, igual ao deploy-when-idle.sh.
set -uo pipefail

REPO=/home/samuel/cockpit
LOG="$HOME/.cockpit/restart-supervisors.log"
MAX_WAIT=${MAX_WAIT:-3600}
STEP=${STEP:-15}

mkdir -p "$(dirname "$LOG")"
exec 9>/tmp/deck-restart-supervisors.lock
flock -n 9 || exit 0

log() { echo "[$(date -Is)] $*" >>"$LOG"; }

log "armado; esperando a box ficar ociosa (teto ${MAX_WAIT}s)"
waited=0
while [ "$waited" -lt "$MAX_WAIT" ]; do
  sleep "$STEP"; waited=$(( waited + STEP ))
  pgrep -f 'claude -p' >/dev/null 2>&1 || break
done
if pgrep -f 'claude -p' >/dev/null 2>&1; then
  log "sem janela ociosa em ${MAX_WAIT}s; supervisores seguem com o env velho"
  exit 1
fi
log "box ociosa aos ${waited}s; rebotando supervisores"

# Só processos DESTE checkout: o repo tem 8 worktrees e o argv do inner é relativo
# (`tsx server/agent.ts`), idêntico em todas. O cwd é o único discriminador — mesma
# razão e mesma checagem do redeploy.sh.
ours() {
  local pid="$1" cwd
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || return 1
  [ "$cwd" = "$REPO" ]
}

pick() {
  local pat="$1" pid out=""
  for pid in $(pgrep -f "$pat" 2>/dev/null); do
    [ "$pid" = "$$" ] && continue
    ours "$pid" && out="$out $pid"
  done
  echo "$out"
}

# Supervisor primeiro: vivo, ele reergueria o inner com o env velho no instante em
# que o matássemos. O inner não segura o flock (`9>&-`), então matar o supervisor
# antes não deixa lock órfão.
bounce() {
  local script="$1" inner="$2" label="$3" pids pid
  pids="$(pick "$REPO/$script") $(pick "$inner")"
  if [ -n "${pids// /}" ]; then
    log "$label: matando supervisor + inner ($pids)"
    # shellcheck disable=SC2086
    kill -TERM $pids 2>/dev/null
    sleep 3
    for pid in $pids; do kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null; done
  else
    log "$label: nada rodando neste checkout"
  fi
  setsid nohup bash "$REPO/$script" >>"$LOG" 2>&1 < /dev/null &
  log "$label: supervisor relançado"
}

bounce run-backend.sh 'server/index.ts' backend
bounce run-agent.sh 'server/agent.ts' agente

sleep 5
code=$(curl -sS -m 4 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${COCKPIT_PORT:-7777}/healthz" 2>/dev/null || echo 000)
log "healthz respondeu $code"
