#!/usr/bin/env bash
# Reinicia backend + agente reerguendo o código atual do working tree. tsx não tem
# hot-reload e os supervisores (./run-backend.sh / ./run-agent.sh na raiz do repo,
# `while true`) só reiniciam o inner quando ELE sai — então a correção é matar só o
# processo inner (node ...server/index.ts | server/agent.ts), nunca o supervisor. O
# supervisor pega o exit e relança com o código novo. Resolve a recorrência "fix no
# main mas processo rodando código de dias atrás" (causa-raiz de 2026-06-17).
#
# Uso: bash scripts/redeploy.sh  (ou `npm run redeploy`). Disparado também pelos
# git hooks em scripts/git-hooks ao atualizar o main tocando server/.
set -uo pipefail

# Mesma porta do supervisor: fixar 7777 aqui faria o redeploy de uma box com
# COCKPIT_PORT diferente sondar uma porta que nunca responde e sempre avisar falha.
HEALTH_URL="http://127.0.0.1:${COCKPIT_PORT:-7777}/healthz"
# Raiz DESTE checkout. O argv do inner é relativo (`tsx server/index.ts`), então o
# argv sozinho não distingue um worktree do outro — o `git worktree list` deste repo
# tem 8. Sem âncora, um redeploy aqui derrubava o backend de todos eles.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)

# É um inner DESTE checkout? Duas condições, ambas necessárias:
#  - UM ARGUMENTO INTEIRO é o caminho do .ts. `pgrep -f` casa qualquer processo que só
#    MENCIONE a string: um `git commit -m "fix server/index.ts"`, um turno do agente
#    com esse texto no prompt ou o próprio `pgrep -af` entravam na lista e levavam
#    SIGKILL. Nesses, a string vive DENTRO de um argumento maior (o `-c` inteiro), e
#    comparar argumento a argumento os elimina.
#  - o cwd do processo é a raiz deste checkout — é o único discriminador de worktree,
#    já que o argv do inner é relativo e idêntico nos oito.
# Sem conseguir ler o /proc, NÃO mata: perder um restart avisa na tela; matar o
# backend errado não tem volta.
is_ours() {
  local pid="$1" script="$2" cwd
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || return 1
  [ "$cwd" = "$ROOT" ] || return 1
  tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null | grep -qxF "$script"
}

restart_inner() {
  local pattern="$1" label="$2"
  local pids="" outros=0
  for pid in $(pgrep -f "$pattern" 2>/dev/null); do
    [ "$pid" = "$$" ] && continue
    if is_ours "$pid" "$pattern"; then pids="$pids $pid"; else outros=$((outros + 1)); fi
  done
  if [ -z "${pids// /}" ]; then
    if [ "$outros" -gt 0 ]; then
      echo "[redeploy] $label: nenhum processo DESTE checkout ($ROOT); $outros de fora preservado(s)"
    else
      echo "[redeploy] $label: nenhum processo ativo (supervisor reergue sozinho)"
    fi
    return 0
  fi
  # Um script que manda SIGKILL precisa ser inspecionável sem matar nada — foi assim
  # que o alvo errado (worktree vizinha, processo que só citava o caminho) passou
  # despercebido. É o que redeploy.test.ts aciona.
  if [ -n "${REDEPLOY_DRY_RUN:-}" ]; then
    echo "[redeploy] $label: DRY RUN, mataria:$pids"
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

[ -n "${REDEPLOY_DRY_RUN:-}" ] && exit 0

# Carimbo do commit que acabou de subir. É o que permite ao doctor.sh detectar
# DRIFT (processo rodando código velho) sem adivinhar: comparar este arquivo com o
# HEAD é barato e não depende de ninguém lembrar de rodar o deploy.
# Existe por causa de 04/09/2026: o fix #519 foi commitado às 22:17 e o backend
# seguiu rodando o código das 19:33 a noite toda, porque o deploy-when-idle exige
# ZERO `claude -p` vivo e desiste depois de 1h — numa box com sessão sempre viva
# ele nunca entrava. O fix estava no disco durante o incidente que ele previne.
mkdir -p "$HOME/.cockpit"
git -C "$ROOT" rev-parse HEAD > "$HOME/.cockpit/running-commit" 2>/dev/null || true

# Espera o supervisor reerguer a porta (até ~20s) pra o redeploy ser observável.
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
