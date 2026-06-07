#!/usr/bin/env bash
# Verificador do backend do cockpit. Confere a invariante e auto-cura.
# Invariante: exatamente 1 supervisor run-backend.sh E :7777 respondendo /healthz.
# Roda via cron (a cada poucos min). Idempotente: se tudo ok, só loga 1 linha e sai.
# Camada de DETECÇÃO/recuperação por cima da PREVENÇÃO (flock no run-backend.sh):
# o flock impede empilhar; este doctor pega o caso do supervisor MORRER (OOM-reap)
# ou de sobrar árvore tsx órfã segurando a :7777.
set -uo pipefail

ROOT=/home/samuel/cockpit
LOG=/tmp/cockpit-doctor.log
log() { echo "[$(date -Is)] $*" >> "$LOG"; }

cd "$ROOT" || { log "FATAL: cd $ROOT falhou"; exit 1; }

# Âncora no fim da linha: casa só `bash ./run-backend.sh`, nunca uma shell
# transitória que mencione o nome no meio do argv (senão dá falso-positivo e o
# doctor reinicia o backend à toa a cada execução do cron).
sup_count=$(pgrep -fc 'run-backend\.sh$' 2>/dev/null || echo 0)
healthy=0
curl -sf --max-time 3 http://127.0.0.1:7777/healthz >/dev/null 2>&1 && healthy=1

if [ "$healthy" = 1 ] && [ "$sup_count" = 1 ]; then
  log "ok (1 supervisor, healthz ok)"
  exit 0
fi

log "ANOMALIA: supervisores=$sup_count healthz=$healthy — recuperando"
pkill -9 -f 'run-backend.sh' 2>/dev/null
sleep 1
pkill -9 -f 'server/index.ts' 2>/dev/null
sleep 2
fuser -k 7777/tcp 2>/dev/null
sleep 1
rm -f /tmp/cockpit-backend.lock
nohup ./run-backend.sh >/tmp/cockpit-backend.log 2>&1 &
sleep 6

if curl -sf --max-time 3 http://127.0.0.1:7777/healthz >/dev/null 2>&1; then
  log "recuperado (healthz ok)"
else
  log "FALHA na recuperação — healthz ainda não responde"
fi
