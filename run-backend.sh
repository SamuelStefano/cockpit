#!/usr/bin/env bash
# Supervisor do backend do cockpit. Mantém de pé a noite toda: se o processo
# morrer (crash, OOM), reinicia após 2s. Loga em /tmp.
cd /home/samuel/cockpit

# Singleton via flock: só UM supervisor por vez. Sem isto, cada ./run-backend.sh
# extra (entre sessões) vira mais um loop brigando pela :7777 — EADDRINUSE infinito
# a cada 2s + storm de tsx que satura a CPU e engasga o WebSocket (causa real do
# "chat não atualiza em tempo real"). O fd 9 segura o lock enquanto o script vive.
exec 9>/tmp/cockpit-backend.lock
if ! flock -n 9; then
  echo "[$(date -Is)] outro supervisor já segura o lock — saindo (não empilha)"
  exit 0
fi

while true; do
  echo "[$(date -Is)] starting cockpit backend on :7777"
  # Mata um listener órfão na :7777 antes de subir, pra nunca cair no EADDRINUSE.
  fuser -k 7777/tcp 2>/dev/null && sleep 1
  COCKPIT_PORT=7777 npx tsx server/index.ts
  echo "[$(date -Is)] backend exited ($?), restarting in 2s"
  sleep 2
done
