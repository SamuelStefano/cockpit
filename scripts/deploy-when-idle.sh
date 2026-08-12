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
STEP=20

mkdir -p "$(dirname "$LOG")"
exec 9>"$LOCK"
flock -n 9 || exit 0   # já tem um deploy adiado armado

ts() { date -Is; }
log() { echo "[$(ts)] $*" >>"$LOG"; }

target=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null)
log "armado em $target; esperando a box ficar ociosa (teto ${MAX_WAIT}s)"

waited=0
while [ "$waited" -lt "$MAX_WAIT" ]; do
  sleep "$STEP"; waited=$(( waited + STEP ))
  # Qualquer `claude -p` vivo = trabalho de alguém em voo (turno, one-shot de
  # triagem, triador de incidentes). Reiniciar agora é exatamente o bug que este
  # lote fecha, então esperamos.
  pgrep -f 'claude -p' >/dev/null 2>&1 && continue
  # Working tree sujo = humano (ou outro agente) editando; o redeploy subiria
  # código pela metade.
  if [ -n "$(git -C "$REPO" status --porcelain 2>/dev/null)" ]; then
    log "tree sujo aos ${waited}s; seguindo em espera"
    continue
  fi
  log "box ociosa aos ${waited}s; redeployando $target"
  bash "$REPO/scripts/redeploy.sh" >>"$LOG" 2>&1 9>&-
  log "redeploy terminou (exit $?)"
  exit 0
done

log "ABORT: ${MAX_WAIT}s sem janela ociosa; $target NÃO foi ativado (rode scripts/redeploy.sh na mão)"
