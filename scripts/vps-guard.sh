#!/usr/bin/env bash
# Guard anti-travamento de VPS (instalado pelo agent-setup.sh em toda box nova,
# roda a cada 3 min via systemd timer ou cron). Versão genérica e auto-contida
# do guarda de load do scripts/doctor.sh — sem healthcheck do backend, porque
# em box de agente o systemd já reergue o serviço sozinho.
#
# Lição do freeze de 2026-06-11 (load 130 em 3 cores): em thrash de swap/I/O
# nenhum processo tem CPU alta — vítima única por %CPU falha. Estratégia em duas
# camadas: tiro cirúrgico no top-3 de CPU não-protegido e, se o load continuar
# alto por 2 ciclos (~6 min) ou for extremo, mata o tmux (pkill) — derruba TODAS
# as sessões de terminal (inclusive Claude rodando dentro) pra box voltar sem
# reboot na mão. Prod em docker/systemd não roda em tmux e fica imune.

set -uo pipefail

LOG=/tmp/vps-guard.log
LOCK=/tmp/vps-guard.lock
STRIKES=/tmp/vps-guard.strikes
CORES=$(nproc 2>/dev/null || echo 1)

exec 8>"$LOCK"
flock -n 8 || exit 0   # outro guard rodando — não empilha

log() { echo "[$(date -Is)] $*" >>"$LOG"; }

# Rotação simples: trunca o log se passar de ~1MB.
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  tail -n 400 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
fi

# Nunca matar no tiro cirúrgico: infra, sessões SSH, o agente Deck, claude e o
# próprio tmux (que só cai na escalada explícita).
PROTECT='dist/|dockerd|containerd|docker-proxy|sshd|systemd|tmux|/claude|claude$| claude |mcp-server|mcp\b|server/agent.ts|vps-guard.sh|postgres|redis'

load1=$(awk '{print $1}' /proc/loadavg)
thresh=$(awk -v c="$CORES" 'BEGIN{print c*4}')    # 4x cores
extreme=$(awk -v c="$CORES" 'BEGIN{print c*16}')  # 16x cores
if awk -v l="$load1" -v t="$thresh" 'BEGIN{exit !(l>t)}'; then
  strikes=$(( $(cat "$STRIKES" 2>/dev/null || echo 0) + 1 ))
  echo "$strikes" >"$STRIKES"
  log "high load1=$load1 (> $thresh) strike=$strikes"
  victims=$(ps -eo pid,pcpu,args --no-headers --sort=-pcpu 2>/dev/null \
    | grep -vE "$PROTECT" \
    | awk 'NR<=3 && $2>10 {print $1}')
  for victim in $victims; do
    vcmd=$(ps -o args= -p "$victim" 2>/dev/null)
    log "KILL runaway pid=$victim (load mitigation): $vcmd"
    kill -TERM "$victim" 2>/dev/null; sleep 2; kill -KILL "$victim" 2>/dev/null
  done
  if [ "$strikes" -ge 2 ] || awk -v l="$load1" -v x="$extreme" 'BEGIN{exit !(l>x)}'; then
    # pkill em vez de `tmux kill-server`: rodando como root (systemd timer), o
    # kill-server só fala com o socket do PRÓPRIO root e não tocaria o tmux dos
    # usuários — pkill derruba servidor+clientes de qualquer uid.
    log "ESCALATE: matando tmux (load1=$load1 strikes=$strikes) — derrubando todas as sessões de terminal"
    pkill -TERM -f '^tmux' 2>/dev/null; sleep 2; pkill -KILL -f '^tmux' 2>/dev/null
    rm -f "$STRIKES"
  fi
else
  rm -f "$STRIKES"
fi

# Guarda de memória: disponível < 150MB → derruba o maior consumidor não
# protegido antes do OOM-killer escolher errado.
avail_mb=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)
if [ "${avail_mb:-9999}" -lt 150 ]; then
  log "low memory: ${avail_mb}MB available"
  victim=$(ps -eo pid,rss,args --no-headers --sort=-rss 2>/dev/null \
    | grep -vE "$PROTECT" \
    | awk 'NR==1 {print $1}')
  if [ -n "${victim:-}" ]; then
    vcmd=$(ps -o args= -p "$victim" 2>/dev/null)
    log "KILL mem hog pid=$victim (oom prevention): $vcmd"
    kill -TERM "$victim" 2>/dev/null; sleep 2; kill -KILL "$victim" 2>/dev/null
  fi
fi

log "ok load1=$load1 mem=${avail_mb:-?}MB"

exit 0
