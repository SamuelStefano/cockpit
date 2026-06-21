#!/usr/bin/env bash
# Hiberna sessões Claude (CLI) ociosas: cada `claude` interativo numa janela tmux
# que está SEM ATIVIDADE há mais de HIBERNATE_HOURS é encerrado pra liberar RAM.
# O contexto NÃO se perde — o Claude grava a sessão em ~/.claude (JSONL); basta
# `claude --resume` na janela pra retomar de onde parou. Mata só o processo, a
# janela tmux continua viva (com um lembrete de como retomar).
#
# Motivação: várias sessões esquecidas abertas em janelas tmux seguram ~250-450MB
# cada e enchem a RAM/swap da VPS de 3.7G (RAM travada em ~77% "sem nada rodando").
#
# Uso: bash scripts/hibernate-idle.sh           (executa)
#      DRY_RUN=1 bash scripts/hibernate-idle.sh (só mostra o que faria)
#      HIBERNATE_HOURS=12 bash scripts/hibernate-idle.sh
set -uo pipefail

HOURS="${HIBERNATE_HOURS:-24}"
DRY="${DRY_RUN:-0}"
NOW=$(date +%s)
THRESH=$(( HOURS * 3600 ))
LOG=/tmp/deck-hibernate.log

log() { echo "[$(date -Is)] $*" | tee -a "$LOG" >/dev/null; }

command -v tmux >/dev/null 2>&1 || { echo "tmux ausente — nada a fazer"; exit 0; }
tmux list-panes -a >/dev/null 2>&1 || { echo "sem servidor tmux — nada a fazer"; exit 0; }

# Mapa pane_pid -> última atividade (epoch) da JANELA daquela pane.
declare -A ACT
declare -A PANE_REF
while IFS='|' read -r ppid act ref cmd; do
  [ -z "$ppid" ] && continue
  ACT["$ppid"]="$act"
  PANE_REF["$ppid"]="$ref"
done < <(tmux list-panes -a -F '#{pane_pid}|#{window_activity}|#{session_name}:#{window_index}|#{pane_current_command}' 2>/dev/null)

reaped=0; freed=0
# Todo processo claude vivo (o filho da shell da pane).
while read -r pid ppid; do
  [ -z "$pid" ] && continue
  act="${ACT[$ppid]:-}"
  ref="${PANE_REF[$ppid]:-?}"
  if [ -z "$act" ]; then
    log "skip pid=$pid: sem pane tmux correspondente (ppid=$ppid) — não mexo"
    continue
  fi
  idle=$(( NOW - act ))
  rss=$(awk '/VmRSS/{printf "%d", $2/1024}' /proc/$pid/status 2>/dev/null || echo 0)
  if [ "$idle" -lt "$THRESH" ]; then
    continue   # ativa dentro da janela — preserva (inclui a sessão atual)
  fi
  h=$(( idle / 3600 ))
  if [ "$DRY" = "1" ]; then
    log "DRY hibernaria pane=$ref pid=$pid (ocioso ${h}h, ${rss}MB)"
    reaped=$((reaped+1)); freed=$((freed+rss)); continue
  fi
  log "hibernando pane=$ref pid=$pid (ocioso ${h}h, ${rss}MB) — contexto salvo, retome com 'claude --resume'"
  kill -TERM "$pid" 2>/dev/null
  sleep 2
  kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null
  # Lembrete na janela: deixa pré-digitado o comando de retomada (sem Enter).
  tmux send-keys -t "$ref" "claude --resume" 2>/dev/null || true
  reaped=$((reaped+1)); freed=$((freed+rss))
done < <(ps -eo pid,ppid,comm 2>/dev/null | awk '$3=="claude"{print $1, $2}')

log "fim: $reaped sessão(ões) ${DRY:+(dry) }hibernada(s), ~${freed}MB liberados (limite ${HOURS}h)"
echo "$reaped sessão(ões) hibernada(s), ~${freed}MB"
