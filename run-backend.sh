#!/usr/bin/env bash
# Supervisor simples: mantém o backend do cockpit de pé a noite toda.
# Se o processo morrer (crash, OOM), reinicia após 2s. Loga em /tmp.
cd /home/samuel/cockpit
while true; do
  echo "[$(date -Is)] starting cockpit backend on :7777"
  COCKPIT_PORT=7777 npx tsx server/index.ts
  echo "[$(date -Is)] backend exited ($?), restarting in 2s"
  sleep 2
done
