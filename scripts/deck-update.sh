#!/usr/bin/env bash
# Atualiza o CLI do Claude Code E reergue o Deck rodando com ele.
#
# `claude update` sozinho não basta: ele troca o install nativo (~/.local/bin/claude),
# mas os processos do Deck já estão de pé com o CLI resolvido no boot. Enquanto não
# reiniciarem, modelo novo continua recusado pela API ("Claude Code X does not support
# this model; version Y or newer is required").
#
# Uso: npm run update            → redeploy adiado (espera a box ficar ociosa)
#      npm run update -- --now   → reinicia já, matando todo `claude -p` em voo
set -uo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
NATIVE="$HOME/.local/bin/claude"
MANAGED_PREFIX="$HOME/.deck-npm"
MANAGED="$MANAGED_PREFIX/bin/claude"
export NPM_CONFIG_PREFIX="$MANAGED_PREFIX"

# Mesma ordem do cliPath(): prefixo gerenciado, depois o nativo, depois o PATH.
CLI="$MANAGED"
[ -x "$CLI" ] || CLI="$NATIVE"
[ -x "$CLI" ] || CLI=$(command -v claude) || { echo "[update] claude não encontrado no PATH"; exit 1; }

echo "[update] antes: $("$CLI" --version 2>/dev/null || echo desconhecido) ($CLI)"
if [ "$CLI" = "$MANAGED" ]; then
  npm install -g --prefix "$MANAGED_PREFIX" --no-audit --no-fund @anthropic-ai/claude-code@latest \
    || echo "[update] aviso: npm install falhou; seguindo com o que já está instalado"
else
  "$CLI" update || echo "[update] aviso: 'claude update' falhou; seguindo com o que já está instalado"
fi

# O update pode ter migrado o npm global pro install nativo — reavalia qual binário
# o Deck vai enxergar agora.
if [ -x "$MANAGED" ]; then CLI="$MANAGED"; elif [ -x "$NATIVE" ]; then CLI="$NATIVE"; fi
echo "[update] depois: $("$CLI" --version 2>/dev/null || echo desconhecido) ($CLI)"

if [ "${1:-}" = "--now" ]; then
  bash "$ROOT/scripts/redeploy.sh"
else
  nohup bash "$ROOT/scripts/deploy-when-idle.sh" >/dev/null 2>&1 &
  echo "[update] restart armado: entra quando não houver turno em voo (log: ~/.cockpit/deploy-when-idle.log)"
fi
