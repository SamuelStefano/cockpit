#!/usr/bin/env bash
# Supervisor do agente T3. Disca pro relay e serve o protocolo. Reinicia se cair.
# flock singleton: só UM agente por vez (senão brigam pelo mesmo agentId no relay).
cd /home/samuel/cockpit
export DECK_RELAY_URL=wss://deck-relay.devfellowship.com
exec 9>/tmp/deck-agent.lock
if ! flock -n 9; then echo "[$(date -Is)] outro agente já roda — saindo"; exit 0; fi
while true; do
  echo "[$(date -Is)] starting deck agent -> $DECK_RELAY_URL"
  npx tsx server/agent.ts
  echo "[$(date -Is)] agent exited ($?), restarting in 2s"
  sleep 2
done
