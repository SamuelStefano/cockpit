# deck-triage

Daemon na VPS do dono (usuário `samuel`) que transforma os relatórios de diagnóstico
(`public.diag_reports`) em triagem no Telegram: checa o caminho inteiro
(DNS, relay, Caddy, WebSocket, Dokploy, bundle do SPA, agentes), pede um diagnóstico ao
Claude sem ferramentas e responde no chat do dono com a causa provável e botões de
correção de uma allowlist fixa. Roda aqui, não no container do deck-ops, porque só esta
máquina tem a chave ssh do relay e as credenciais do Dokploy.

## Fluxo

1. A cada 60 s busca relatórios novos no host do relay (ssh + curl no PostgREST com o
   env do relay; a service role nunca sai de lá). Cursor em `~/.cache/deck-triage/cursor.json`;
   no primeiro boot começa em "agora".
2. Agrupa por incidente: mesmo `kind` + conta dentro de 15 min.
3. Portão de queda. Só escala (Claude + Telegram) quando confirmado:
   - checagem sintética falhando daqui (falha duas vezes, com 15 s entre elas);
   - repórter confiável (`TRUSTED_REPORTER_EMAILS`): escala na hora, mesmo com tudo verde;
   - 2+ contas com o mesmo `kind` em 10 min;
   - uma conta só, persistindo 10+ min com o servidor verde: mensagem curta "lado do
     cliente" (sem Claude).
   O resto só vai pro log.
4. A cada 2 min roda as checagens sintéticas sozinho: avisa uma vez quando cai e uma vez
   quando volta ("Recuperado").
5. Botões: `Reiniciar relay`, `Recarregar Caddy`, `Redeploy deck-web`, `Redeploy deck-ops`,
   `Reiniciar agente local`, `Ignorar`. Cada um mapeia para um comando fixo em
   `actions.ts`; nada vem do relatório nem do modelo. Cooldown por ação e teto de 6 ações
   por hora. Depois de agir, recheca e responde ("Rechecagem: voltou").
6. `/status` no chat roda tudo sob demanda.

Callbacks e mensagens só são aceitos se o chat E o remetente forem `TELEGRAM_CHAT_ID`.
Este daemon é o único consumidor de `getUpdates` do bot (o deck-ops só envia).

## Segurança do Claude

`claude -p --tools '' --allowed-tools '' --permission-mode default --strict-mcp-config
--setting-sources ''`, cwd vazio, orçamento de US$ 0,25, no máximo 6 chamadas por hora.
O texto do relatório é sanitizado (sem bytes de controle/bidi, sem `<>`, cortado) e vai
dentro de uma tag com nonce. A resposta precisa ser JSON exato com ids da allowlist;
qualquer coisa fora disso descarta a resposta e vale o diagnóstico por regras.

## Configuração

`~/.config/deck-triage/env` (chmod 600; o daemon recusa arquivo legível por grupo/outros):

```sh
TELEGRAM_BOT_TOKEN=123456:ABC...        # mesmo bot do deck-ops (@Deck_Ops_bot)
TELEGRAM_CHAT_ID=8831502964             # opcional, default o chat do dono
TRUSTED_REPORTER_EMAILS=samuelstefanodocarmo@gmail.com,taigfs@gmail.com
# opcionais:
# ANTHROPIC_API_KEY=sk-ant-...          # se presente, usa --bare com a API key; sem ela usa o login do claude
# DECK_TRIAGE_MODEL=claude-sonnet-4-6
# CLAUDE_BIN=/home/samuel/.local/bin/claude
# RELAY_SSH=ubuntu@163.176.220.63
# RELAY_SSH_KEY=/home/samuel/.ssh/oracle_relay
# DOKPLOY_CREDENTIALS=/home/samuel/.config/dokploy/credentials
# DECK_TRIAGE_STATE=/home/samuel/.cache/deck-triage
# DECK_LOCAL_REPO=/home/samuel/cockpit
```

Também lê `~/.config/dokploy/credentials` (já existe) e usa `~/.ssh/oracle_relay`.
`Reiniciar agente local` usa `sudo -n systemctl restart deck-agent` (sudo sem senha desta
VPS) e SIGTERM no agente do `~/cockpit`, que o supervisor reergue.

## Instalar

```sh
install -d -m 700 ~/.config/deck-triage
$EDITOR ~/.config/deck-triage/env && chmod 600 ~/.config/deck-triage/env
mkdir -p ~/.config/systemd/user
ln -sf ~/cockpit/scripts/deck-triage/deck-triage.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now deck-triage
journalctl --user -u deck-triage -f
```

Rodar na mão: `cd ~/cockpit && node scripts/deck-triage/main.ts` (Node 22, sem dependências).
Estado em `~/.cache/deck-triage/`: `cursor.json`, `tg-offset.json`, `actions.log`.
Testes: `npx vitest run scripts/deck-triage`.
