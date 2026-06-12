#!/usr/bin/env bash
# Watchdog do cockpit (chamado pelo cron a cada 3 min). Objetivo: a box NUNCA mais
# travar. Causa do freeze de 2026-06-08 foi um CLI interativo (`vercel` sem token)
# pendurado lendo stdin + storm de processo que saturou o load (15min em 24.58).
#
# Esta box roda DFL PROD (node dist/*, docker). Por isso o watchdog é CIRÚRGICO:
# só mexe no que é claramente do cockpit/seguro-de-matar. Allowlist protege prod,
# claude, tmux, ssh, docker, mcp. flock garante um doctor por vez.

set -uo pipefail

LOG=/tmp/cockpit-doctor.log
LOCK=/tmp/cockpit-doctor.lock
HEALTH_URL="http://127.0.0.1:7777/healthz"
SUPERVISOR=/home/samuel/cockpit/run-backend.sh
CORES=$(nproc 2>/dev/null || echo 1)

exec 8>"$LOCK"
flock -n 8 || exit 0   # outro doctor rodando — não empilha

log() { echo "[$(date -Is)] $*" >>"$LOG"; }

# Rotação simples: trunca o log se passar de ~1MB (a box é pequena).
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  tail -n 400 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
fi

# Processos que NUNCA devem ser mortos por engano (prod + infra + sessões vivas).
PROTECT='dist/|dockerd|containerd|docker-proxy|sshd|systemd|tmux|/claude|claude$| claude |mcp-server|mcp\b|run-backend.sh|run-agent.sh|doctor.sh|server/index.ts|server/agent|server/server.js|postgres|redis'

# ── 1. CLI interativo pendurado = causa do freeze. Mata auth-CLIs que ficam
#       esperando stdin. Deploy de verdade usa --token e termina rápido; qualquer
#       um destes vivo > 90s é prompt travado. Esta é a defesa principal.
HUNG=$(ps -eo pid,etimes,args --no-headers 2>/dev/null | awk '
  $2 > 90 && /vercel|gh auth login| login( |$)|expo login|supabase login|npm login|wrangler login/ && !/--token|doctor.sh|grep|awk/ {print $1}')
for pid in $HUNG; do
  cmd=$(ps -o args= -p "$pid" 2>/dev/null)
  log "KILL hung interactive CLI pid=$pid: $cmd"
  kill -TERM "$pid" 2>/dev/null; sleep 1; kill -KILL "$pid" 2>/dev/null
done

# ── 2. Backend health. Se não responder 200, garante o supervisor de pé. O
#       supervisor (flock próprio) sobe a :7777; não duplicamos lógica aqui.
code=$(curl -sS -m 5 -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)
if [ "$code" != "200" ]; then
  log "backend unhealthy (HTTP $code)"
  if ! pgrep -f 'run-backend.sh' >/dev/null 2>&1; then
    log "supervisor down -> starting $SUPERVISOR"
    nohup bash "$SUPERVISOR" >/tmp/cockpit-backend.out 2>&1 &
  else
    log "supervisor alive; aguardando ele reerguer a :7777"
  fi
fi

# ── 2b. Agente T3 (ponte VPS↔relay). Sem ele o app não alcança a box ("não
#       conecta de jeito nenhum", 2026-06-12 — o freeze matou a árvore inteira do
#       run-agent.sh e nada o reerguia). O run-agent.sh tem flock próprio, então
#       relançar com ele já vivo é no-op seguro.
AGENT_SUPERVISOR=/home/samuel/cockpit/run-agent.sh
if ! pgrep -f 'run-agent.sh' >/dev/null 2>&1; then
  log "agent supervisor down -> starting $AGENT_SUPERVISOR"
  nohup bash "$AGENT_SUPERVISOR" >>/tmp/deck-agent.out 2>&1 &
fi

# ── 3. Guarda de load. load1 alto = storm. No freeze de 2026-06-11 (load 130 em
#       3 cores, thrash de swap/I/O) NENHUM processo tinha >50% de CPU — a vítima
#       única falhou e a box ficou travada. Agora: tiro cirúrgico no top-3 de CPU
#       não-protegido (barra baixa, 10%) e, se o load persistir por 2 ciclos do
#       cron (~6 min) ou for extremo, último recurso pedido pelo Samuel:
#       `tmux kill-server` — derruba TODAS as sessões de terminal (incluindo
#       Claude rodando dentro) pra box voltar sem precisar de reboot na mão.
STRIKES=/tmp/cockpit-doctor.strikes
load1=$(awk '{print $1}' /proc/loadavg)
thresh=$(awk -v c="$CORES" 'BEGIN{print c*4}')    # 4x cores (=12 em 3 cores)
extreme=$(awk -v c="$CORES" 'BEGIN{print c*16}')  # 16x cores (=48 em 3 cores)
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
    log "ESCALATE: tmux kill-server (load1=$load1 strikes=$strikes) — derrubando todas as sessões de terminal"
    tmux kill-server 2>/dev/null
    rm -f "$STRIKES"
  fi
else
  rm -f "$STRIKES"
fi

# ── 4. Guarda de memória. Se disponível < 150MB, derruba o MAIOR consumidor não
#       protegido pra não ir pro OOM-killer (que pode escolher o prod).
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

# ── 5. Heartbeat (prova de vida). Uma linha por ciclo, leve, pra `tail` confirmar
#       que o watchdog está vivo. Rotação acima evita o log crescer sem fim.
log "ok load1=$load1 mem=${avail_mb}MB healthz=$code"

exit 0
