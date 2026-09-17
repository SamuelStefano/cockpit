#!/usr/bin/env bash
# Supervisor do agente T3. Disca pro relay e serve o protocolo. Reinicia se cair.
# flock singleton: só UM agente por vez (senão brigam pelo mesmo agentId no relay).
cd /home/samuel/cockpit
export DECK_RELAY_URL=wss://deck-relay.devfellowship.com
# Esta é a box do DONO (Samuel) — role admin = controle total (terminais/admin).
# Numa box de fellow, omitir (default 'student' = least-capability).
export DECK_AGENT_ROLE=admin
exec 9>/tmp/deck-agent.lock
if ! flock -n 9; then echo "[$(date -Is)] outro agente já roda — saindo"; exit 0; fi
while true; do
  # Overrides locais por-box (NÃO versionado). O agente é quem spawna o run e avalia
  # o gate de bypass, então a flag COCKPIT_ALLOW_BYPASS precisa estar AQUI (não só no
  # backend). Sem o arquivo, nada muda (default seguro).
  # `set -a` marca pra exportação tudo que o source definir: sem isto uma linha sem
  # `export` fica só no shell do supervisor e NÃO chega no processo do agente.
  #
  # DENTRO do loop, não antes dele: o supervisor vive meses (este tinha 68 dias) e o
  # redeploy só mata o INNER. Lido uma vez só, toda variável acrescentada ao arquivo
  # depois do boot do supervisor nunca chegava no agente — foi assim que
  # COCKPIT_MAX_COLD_INFLIGHT=0 ficou sem efeito e o semáforo de cold-start seguiu
  # estacionando prompt numa conta Max 20x (16/09/2026).
  set -a
  # shellcheck disable=SC1091
  [ -f "$HOME/.cockpit-local.env" ] && source "$HOME/.cockpit-local.env"
  set +a
  echo "[$(date -Is)] starting deck agent -> $DECK_RELAY_URL"
  # 9>&-: o inner não herda o fd do flock. Se sobrevivesse ao supervisor (órfão de
  # freeze/OOM) seguraria o lock e nenhum supervisor novo subiria.
  npx tsx server/agent.ts 9>&-
  echo "[$(date -Is)] agent exited ($?), restarting in 2s"
  sleep 2
done
