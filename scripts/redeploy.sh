#!/usr/bin/env bash
# Reinicia backend + agente reerguendo o código atual do working tree. tsx não tem
# hot-reload e os supervisores (run-backend.sh / run-agent.sh, `while true`) só
# reiniciam o inner quando ELE sai — então a correção é matar só o processo inner
# (node ...server/index.ts | server/agent.ts), nunca o supervisor. O supervisor
# pega o exit e relança com o código novo. Resolve a recorrência "fix no main mas
# processo rodando código de dias atrás" (causa-raiz de 2026-06-17).
#
# Uso: bash scripts/redeploy.sh  (ou `npm run redeploy`). Disparado também pelos
# git hooks em scripts/git-hooks ao atualizar o main tocando server/.
set -uo pipefail

HEALTH_URL="http://127.0.0.1:7777/healthz"

restart_inner() {
  local pattern="$1" label="$2"
  # pgrep -f casa supervisor E inner; o supervisor (bash run-*.sh) NÃO tem o
  # caminho server/*.ts no argv, então filtrar por ele é redundante — mas o -f
  # do pattern já é o caminho do .ts, que só o inner (npm/sh/node) carrega.
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null | tr '\n' ' ')
  if [ -z "${pids// /}" ]; then
    echo "[redeploy] $label: nenhum processo ativo (supervisor reergue sozinho)"
    return 0
  fi
  echo "[redeploy] $label: reiniciando inner (pids: $pids)"
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null
  sleep 3
  # Escalada SÓ nos PIDs originais que sobreviveram ao TERM — nunca re-grepar, pra
  # não matar um inner novo que o supervisor já tenha reerguido nesse meio-tempo.
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid" 2>/dev/null; fi
  done
}

restart_inner "server/index.ts" "backend"
restart_inner "server/agent.ts" "agente"

# Espera o supervisor reerguer a :7777 (até ~20s) pra o redeploy ser observável.
for i in $(seq 1 10); do
  sleep 2
  code=$(curl -sS -m 4 -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    echo "[redeploy] backend saudável (HTTP 200) após ${i}x2s"
    exit 0
  fi
done
echo "[redeploy] aviso: backend não respondeu 200 em 20s — confira run-backend.sh / doctor.sh"
exit 0
