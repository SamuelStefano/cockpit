#!/usr/bin/env bash
# Protege a main antes de existir mais gente com acesso de escrita.
#
# Por padrão só MOSTRA o que faria. Nada é aplicado sem --apply, e convite de
# colaborador nunca é enviado por este script — dar acesso a um repositório é ação
# externa e irreversível na prática, então fica na mão do dono.
#
#   bash scripts/setup-repo-protection.sh            # mostra
#   bash scripts/setup-repo-protection.sh --apply    # aplica
set -euo pipefail

REPO="${REPO:-SamuelStefano/cockpit}"
BRANCH="${BRANCH:-main}"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

command -v gh >/dev/null || { echo "gh não encontrado"; exit 1; }

# Contextos que precisam estar verdes. Os nomes têm que casar com os jobs do
# .github/workflows/ci.yml — se um job for renomeado lá, atualize aqui, senão a
# proteção passa a exigir um check que nunca reporta e a main trava.
CHECKS='["gate","smoke"]'

read -r -d '' PAYLOAD <<JSON || true
{
  "required_status_checks": { "strict": true, "contexts": ${CHECKS} },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
JSON

echo "repo:   $REPO"
echo "branch: $BRANCH"
echo
echo "Regras:"
echo "  - CI verde (gate + smoke) antes do merge, com a branch atualizada"
echo "  - 1 aprovação, e revisão de CODEOWNERS nos caminhos sensíveis"
echo "  - aprovação antiga é descartada quando chega commit novo"
echo "  - sem force-push e sem deletar a main"
echo "  - enforce_admins=false: o dono continua conseguindo destravar sozinho se o"
echo "    CI quebrar por causa externa. Ligue quando houver mais de um mantenedor."
echo

if [[ $APPLY -eq 0 ]]; then
  echo "(simulação — rode com --apply para valer)"
  exit 0
fi

echo "$PAYLOAD" | gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" \
  -H "Accept: application/vnd.github+json" --input - >/dev/null
echo "proteção aplicada."

cat <<'TXT'

Acesso de colaborador NÃO é concedido por este script, de propósito.
Quando decidir, o comando é:

  gh api -X PUT repos/SamuelStefano/cockpit/collaborators/USUARIO -f permission=push   # escrita
  gh api -X PUT repos/SamuelStefano/cockpit/collaborators/USUARIO -f permission=pull   # leitura

Antes de dar escrita a alguém, confira:
  - CONTRIBUTING.md lido (as 7 linhas invioláveis)
  - CODEOWNERS cobre o que aquela pessoa não deve mexer sozinha
  - a proteção da main já está aplicada
TXT
