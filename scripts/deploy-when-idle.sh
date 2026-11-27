#!/usr/bin/env bash
# Redeploy adiado até a box ficar ociosa. tsx não tem hot-reload: mudança em
# server/ só vale depois de reiniciar o inner — e reiniciar mata TODO `claude -p`
# em voo, inclusive o turno que está pedindo o deploy. Este script quebra o
# impasse: sai do turno atual, espera ninguém mais estar rodando, e só então
# reinicia.
#
# Uso: nohup bash scripts/deploy-when-idle.sh >/dev/null 2>&1 &  (do próprio turno)
#
# Substitui os ~/.cockpit/deploy-*.sh ad-hoc que eram recriados a cada lote — um
# deles chegou a reiniciar o agente com outros turnos vivos.
set -uo pipefail

REPO=/home/samuel/cockpit
LOG="$HOME/.cockpit/deploy-when-idle.log"
LOCK=/tmp/deck-deploy-when-idle.lock
MAX_WAIT=${MAX_WAIT:-3600}   # teto duro: nenhum watcher deste repo vira órfão eterno
# Passo da sondagem. O gatilho por DRIFT (doctor.sh, passo 4c) aperta pra 5s: numa
# box com turno quase sempre vivo a janela ociosa é curta, e sondar de 20 em 20
# segundos passava batido por ela — o watcher rodava o tempo todo sem nunca pegar.
STEP=${STEP:-20}

mkdir -p "$(dirname "$LOG")"
exec 9>"$LOCK"
flock -n 9 || exit 0   # já tem um deploy adiado armado

ts() { date -Is; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

# A `claude -p` that already answered and only waits on a background task (dev
# server, poll loop) stays alive for hours and blocked every deploy. The CLI's own
# registry (~/.claude/sessions/<pid>.json) says `idle` for it; past the grace
# window it no longer counts as work in flight. No registry file = busy.
BG_IDLE_GRACE=${BG_IDLE_GRACE:-600}
busy_claude() {
  local pid
  for pid in $(pgrep -f 'claude -p'); do
    python3 - "$pid" "$BG_IDLE_GRACE" <<'PY' 2>/dev/null || echo "$pid"
import json, os, sys, time
pid, grace = sys.argv[1], int(sys.argv[2])
d = json.load(open(os.path.expanduser(f"~/.claude/sessions/{pid}.json")))
idle_for = time.time() - d.get("updatedAt", 0) / 1000
sys.exit(0 if d.get("status") == "idle" and idle_for > grace else 1)
PY
  done
}

target=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null)
log "armado em $target; esperando a box ficar ociosa (teto ${MAX_WAIT}s)"

waited=0
while [ "$waited" -lt "$MAX_WAIT" ]; do
  sleep "$STEP"; waited=$(( waited + STEP ))
  # Qualquer `claude -p` vivo = trabalho de alguém em voo (turno, one-shot de
  # triagem, triador de incidentes). Reiniciar agora é exatamente o bug que este
  # lote fecha, então esperamos.
  [ -n "$(busy_claude)" ] && continue
  # Working tree sujo = humano (ou outro agente) editando; o redeploy subiria
  # código pela metade.
  if [ -n "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]; then
    log "tree sujo aos ${waited}s; seguindo em espera"
    continue
  fi
  # Only main deploys: the incident triager works on a branch in this checkout.
  branch=$(git -C "$REPO" rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ "$branch" != "main" ]; then
    log "HEAD em '$branch' (não main) aos ${waited}s; seguindo em espera"
    continue
  fi
  log "box ociosa aos ${waited}s; redeployando $target"
  bash "$REPO/scripts/redeploy.sh" >>"$LOG" 2>&1 9>&-
  log "redeploy terminou (exit $?)"
  exit 0
done

# Desistir aqui deixou de ser definitivo: o doctor.sh compara o
# ~/.cockpit/running-commit com o HEAD a cada 3 min e re-arma este watcher enquanto
# houver drift. Antes o ABORT era o fim da linha e o fix ficava no disco (04/09/2026,
# o #519 esperou 6h e o incidente aconteceu no meio).
log "sem janela ociosa em ${MAX_WAIT}s; $target ainda não ativado — o doctor re-arma em até 3min"
