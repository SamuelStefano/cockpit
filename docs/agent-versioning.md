# Versionamento de agentes e skills

Tudo na própria box, sem GitHub. Cada salvamento de agente (`server/agents/store.ts`) e cada
instalação/edição de skill (`server/skills.ts`, registro, ou edição direta no disco) gera um
snapshot imutável em `~/.deck-agent/versions/<agent|skill>/<id>/<ts>-<sha8>.json`.

- Snapshot idêntico ao último é ignorado; ordem garantida por timestamp monotônico.
- Retenção: 50 por item (`MAX_VERSIONS_PER_ITEM`), os mais antigos saem primeiro.
- Agente: o JSON do `AgentConfig`; remoção grava um marcador "removido" (não restaurável).
- Skill: o `SKILL.md`. Edições feitas direto no disco são capturadas quando o painel abre.
  Só o `SKILL.md` é versionado (arquivos auxiliares da skill ficam de fora).
- Diff unificado próprio (`server/versions/diff.ts`, LCS por linha), sem dependência nova.
- Restaurar = novo snapshot igual ao antigo (histórico nunca é reescrito).
- Frames: `versions-list`, `versions-diff` (admin) e `versions-restore` (root; agente exige
  também `COCKPIT_LOCAL_ONLY`, igual a salvar agente personalizado).
- UI: botão "Versões" no painel do agente e no modal da skill.

## Workspace dos agentes em git (Fase 4)

- Clone local em `~/.deck-agent/agents-repo/`, uma pasta `<bot-id>/` por agente com os arquivos de
  texto editáveis do workspace (mesma allowlist do `team-file-put`). Sem GitHub = só histórico local.
- Cada `team-file-put` bem-sucedido vira commit `"<agente>: <caminho>"` (autor Deck).
- Frames: `team-ws-log-get` e `team-ws-diff-get` (qualquer papel, só bot do time), `team-ws-restore` e
  `team-ws-sync` (admin), `team-ws-repos-get` e `team-ws-connect` (root).
- GitHub: o token da instalação do GitHub App chega ao git só pelo credential helper. O App não cria
  repositório em conta de usuário, então o usuário escolhe um que a instalação acessa (ex.: `deck-agents`).
- Push após cada commit, em fila com retry de 1 min se offline. Pull: botão "Sincronizar", ao abrir o
  perfil e a cada 10 min. Conflito mantém o arquivo do bot e grava a versão do repo como
  `<nome>.remote<ext>` (ex.: `CLAUDE.remote.md`; settings vira `claude-settings.remote.json`).
- Settings vindos do repo só entram se forem regras deny/ask; o resto vira cópia `.remote` para o admin.
- Git roda via `execFile` com argv, `--` antes de caminhos, sem config global e com `core.hooksPath` vazio.

## Ferramentas avaliadas (pesquisa)

Fontes são comparativos de blogs, em boa parte de fornecedores; não verificado em fonte primária.

| Ferramenta | O que faz | Adotar? |
|---|---|---|
| [Langfuse](https://fast.io/resources/best-tools-for-ai-agent-prompt-versioning/) | Prompt registry self-hosted, versão imutável, rollback movendo label | Não: serviço pesado (DB + app) pra uma box de 3,7 GB |
| [Agenta](https://agenta.ai/blog/top-open-source-prompt-management-platforms) | Registry open source, variantes como branches | Não: mesma razão; recursos enterprise em licença separada |
| [promptfoo](https://www.lyzr.ai/blog/prompt-management-tools/) | Teste de regressão de prompts em CI | Complementar, não substitui snapshots; avaliar depois |
| [PromptLayer](https://futureagi.com/blog/best-prompt-registry-tools-for-ai-teams-in-2026/) | Registry SaaS p/ não-devs | Não: núcleo proprietário, dado sai da box |
| Pezzo | LLMOps cloud-native | Não: nada encontrado sobre versionamento |
| Store em git | Não achei ferramenta pronta | Possível evolução: `git init` no diretório de versões |

Os nomes novos que o Tainan citou não ficaram claros; vale perguntar a ele.
