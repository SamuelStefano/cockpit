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
   - repórter confiável (`TRUSTED_REPORTER_EMAILS`) com relatório `manual`: escala na
     hora, mesmo com tudo verde (relatórios automáticos não ganham esse atalho);
   - 2+ contas com o mesmo `kind` em 10 min;
   - uma conta só com 3+ relatórios persistindo 10+ min e o servidor verde: mensagem curta
     "lado do cliente" (sem Claude).
   O resto só vai pro log.
4. A cada 2 min roda as checagens sintéticas sozinho. Uma queda só é anunciada depois de
   5 min seguidos falhando (um soluço que volta antes disso fica só no log, sem mensagem
   nem Claude); "Recuperado" só sai se a queda foi anunciada.
5. Botões: `Reiniciar relay`, `Recarregar Caddy`, `Redeploy deck-web`, `Redeploy deck-ops`,
   `Reiniciar agente local`, `Ignorar`. Cada um mapeia para um comando fixo em
   `actions.ts`; nada vem do relatório nem do modelo. Cooldown por ação e teto de 6 ações
   por hora. Depois de agir, recheca e responde ("Rechecagem: voltou").
6. `/status` no chat roda tudo sob demanda (com as últimas linhas do log do relay).
7. Menos ruído: as mensagens que não são de queda (triagem de incidente, lado do cliente)
   dividem um orçamento de 6 por hora e 12 por dia; o excedente vai pro log e pro
   `/metricas`. `/status`, respostas de botão, queda e recuperação não contam. A triagem
   lista só o que falha ou avisa, mais `+N verdes`.

## Login e auto-correção

- `login_path` (sintética): abre `wss://<relay>/ws?token=<JWT forjado e sem assinatura>` com
  `Origin` do deck e espera o fechamento `4401` em até 5 s. Qualquer outra coisa, ou nada em
  12 s, é falha. Pega o travamento do JWKS que as outras checagens (agentes, /status) não pegam.
  O token não é segredo: só pode ser recusado.
- `auth_flow` (sintética): conta no journal do relay, nos últimos 10 min (zerando no último
  `relay_start`), `browser_auth_ok`, `browser_close` com 4408 e `browser_auth_stall`.
  Falha com 3+ fechamentos 4408 e nenhum login ok.
- `responder.ts`: com `login_path` ou `auth_flow` falhando há 5+ min, roda `Reiniciar relay`
  sozinho pelo mesmo portão de ações (e no máximo 1 vez por 60 min), registra em
  `actions.log` com `ref: auto`, rechecka após 20 s e manda UMA mensagem com o resultado.
- Investigador: se a queda continua 5+ min depois do reinício automático, ou qualquer queda
  sintética passa de 15 min, roda
  `deckctl new "<prompt fixo>" --cwd ~ --title "Deck fora: investigar" --model claude-opus-5-5`
  (timeout 30 s, no máximo 1 a cada 6 h) e manda o sessionId no Telegram. O prompt é uma
  constante mais os ids das checagens falhando (allowlist de `CheckId`); nunca `detail`,
  relatório ou log. `/investigar` dispara a mesma chamada, sob o mesmo limite.
- Só uma ação do responder por vez, respeitando `busy`; nada disso bloqueia o loop do Telegram.

## Métricas

Depois de cada rodada sintética, `~/.cache/deck-triage/metrics.jsonl` (modo 600) ganha uma
linha com os ids falhando, `login_ms` e as contagens do `auth_flow`; também registra
mensagens enviadas/contidas, auto-correções e investigações. Linhas com mais de 14 dias saem
na partida e no máximo 1 vez por dia. `/metricas` responde (24 h e 7 d) com disponibilidade
por checagem, login p50/máx, totais de 4408 e travadas (aproximados: a janela de 10 min se
sobrepõe), mensagens e ações. Não há resumo periódico. Cada rodada também grava
`~/.cache/deck-triage/heartbeat` (epoch em segundos, escrita atômica).

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
# DECKCTL_BIN=/home/samuel/.local/bin/deckctl   # usado pelo investigador
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
Estado em `~/.cache/deck-triage/`: `cursor.json`, `tg-offset.json`, `actions.log`, `metrics.jsonl`, `heartbeat`.
Testes: `npx vitest run scripts/deck-triage`.
