# Deck — Architecture (para uma IA entender o app inteiro)

> Este arquivo existe pra qualquer IA (ou pessoa) que cai no repo entender, em uma
> leitura, o que é o Deck, como as peças se conectam, e onde mexer. Mantém atualizado
> quando a topologia mudar.

## O que é o Deck

Deck (codinome interno **cockpit**) é um app pessoal que dá uma interface web (chat +
terminais) pro **Claude CLI** que roda na VPS do usuário. A tela mostra os chats; o
**cérebro roda na VPS do usuário** (o binário `claude -p` logado na conta dele). É
app **pessoal** do Samuel até funcionar — não é da DFL ainda. Repo: `SamuelStefano/cockpit`.

A ideia de produto: cada pessoa traz a própria VPS + a própria conta Claude. Assim o
custo por usuário fica plano (não centraliza inferência num servidor só).

## Topologia T3 (três camadas)

```
  Browser (SPA, Vercel)                  relay (VPS dedicada)              agent (VPS do usuário)
  ┌────────────────────┐   wss://.../ws  ┌──────────────────┐   wss://.../agent ┌──────────────────┐
  │ React + Vite + TS  │ ───────────────▶│ roteador WS       │◀──────────────────│ disca pro relay  │
  │ login Supabase     │                 │ stateless+autent. │                   │ roda claude -p   │
  │ mostra chat/term   │◀─────────────── │ por accountId     │ ─────────────────▶│ (engine local)   │
  └────────────────────┘    frames       └──────────────────┘     frames         └──────────────────┘
                                                                                         │ spawn
                                                                                         ▼
                                                                                     claude CLI
```

1. **Browser / SPA** (`src/`): React 18 + Vite 5 + TS + Tailwind. Deploy na **Vercel**.
   Faz login no **Supabase Auth** (email/senha), recebe um JWT, e abre um WebSocket
   pro relay (`wss://deck-relay.devfellowship.com/ws?token=<JWT>`). Só renderiza —
   não tem backend próprio em produção.

2. **Relay** (`relay/`): roteador WebSocket **stateless e autenticado**. Roda numa VPS
   **dedicada** (hoje Oracle Cloud free, `deck-relay.devfellowship.com`, atrás de Caddy/TLS).
   - **NÃO spawna nada** (a fronteira é garantida por `relay/boundary.test.ts`).
   - **NÃO guarda chave de assinatura** — só material público (JWKS) + o que o Store devolve.
   - Roteia por `accountId` derivado **no servidor** a partir do JWT, nunca por dado do frame.
   - Browser e agente entram por caminhos de auth **separados** (`/ws` vs `/agent`).

3. **Agent** (`server/agent.ts`): roda na **VPS do usuário**. Em vez de escutar, **disca**
   pro relay e serve o MESMO protocolo do backend pelo socket de saída. Quando o browser
   manda um frame, o relay encaminha pro agente daquela conta; o agente roda `claude -p`
   local e as respostas voltam por broadcast → relay → browser. A chave privada Ed25519
   **nasce e fica** na VPS do usuário (`~/.deck-agent/identity.json`, 0600).

## Autenticação e identidade

- **Browser → relay**: JWT do Supabase, verificado no relay via **JWKS** (`relay/src/verify.ts`).
  `roleFromIdentity` resolve o papel: **root** (allowlist por env `COCKPIT_ROOT_EMAILS`),
  **admin** (flag `is_admin` no DB), ou **fellow**. Default-deny: sem JWT válido, fecha 4401.
- **Agent → relay**: handshake **Ed25519 challenge-response**. O agente manda `agent-hello`
  com seu `agentId`; o relay devolve um `challenge` (nonce); o agente assina `nonce.agentId`
  com a privada; o relay verifica contra a pubkey guardada no Store. (`relay/src/index.ts` path `/agent`.)
- **Pareamento**: o browser logado faz `POST /pair/new` → relay gera um código single-use/TTL.
  O usuário roda o agente com `--pair=CÓDIGO`; o agente apresenta código+pubkey; o relay
  consome o código (atômico) e registra o `agentId`. (`pairAgent` em `server/agent.ts`.)
  O endpoint aceita o JWT **só** em `Authorization: Bearer` (query string vazaria o token
  pro access log) e é limitado a 5 códigos/min por conta — cada código é uma linha nova
  no banco, então sem teto uma conta logada em loop enche a tabela.

## Fluxo de uma mensagem

1. Usuário digita no chat (SPA) → frame `{t:'send', text, sessionKey}` pelo WS do browser.
2. Relay recebe no path `/ws`, resolve `accountId` do JWT, e roteia o frame **opaco** pro
   agente daquela conta (`registry.toAgent`). Se não houver agente, devolve `agent-offline`.
3. Agente recebe, `serveConnection` processa (mesmo código do backend local), spawna/continua
   `claude -p` no cwd isolado, e faz stream das respostas.
4. Respostas saem por `broadcast` → `setClientSource([socket do agente])` → relay → todas as
   abas daquela conta (`registry.toBrowsers`). Escopo é **por conta** o tempo todo.

## Health checks e supervisão (resiliência)

A box NÃO pode travar. Camadas:

- **Backend local (`server/index.ts`)**: expõe `/healthz` (liveness do event loop).
  Supervisor `run-backend.sh` (flock singleton) reinicia o backend se cair e libera a :7777.
- **Watchdog do host (`scripts/doctor.sh`, cron a cada 3 min)**: mata CLI interativo pendurado
  (causa de freeze — ex.: `vercel`/`gh login` sem token > 90s), garante o supervisor de pé,
  e tem guarda de load/memória com **allowlist** (protege DFL prod, docker, claude, tmux, ssh).
  Heartbeat em `/tmp/cockpit-doctor.log`.
- **Agent (`server/agent.ts`)** — health checks embutidos, valem pra QUALQUER VPS de usuário:
  - **Link**: ping+**checa pong** a cada 30s; socket meio-aberto → `terminate()` → reconnect
    com backoff exponencial (`backoffMs`).
  - **Recurso**: `startHealthGuard()` a cada 60s; se load1 > 4×cores OU mem < 120MB, chama
    `killAllRuns()` pra liberar a VPS antes do OOM-killer (um `claude -p` desgovernado não trava a box).
  - **Processo**: supervisor `run-agent.sh` (flock singleton) reinicia o agente se ele morrer.
- **Relay (`relay/src/index.ts`)**: heartbeat ping/pong nos dois servidores (browser+agent),
  timeout de socket pré-auth (agente 15s, browser 20s) e cap de tentativas — defesa contra exaustão.
  - **Falha do store nega, não derruba.** Todo caminho de auth encosta na rede (JWKS +
    PostgREST) dentro de um handler **async de evento**: uma rejeição solta ali vira
    `unhandledRejection` e o Node mata o processo — o que desconectaria TODAS as contas por
    causa de uma. Os três sítios (`identityFrom`, frame do browser, frame do agente) capturam:
    identidade que falhou é identidade negada, frame de administração que falhou não responde,
    socket de agente que falhou fecha `4500` e reconecta com backoff.
  - **Timeout no store** (`relay/src/store.ts`, `AbortSignal.timeout(10s)`): sem ele um
    PostgREST que aceita a conexão e nunca responde pendura o socket que espera por ele.

## Layout do repositório

```
src/                 SPA React (deploy Vercel)
  App.tsx            monta o chrome; o gate de login sai de app/AuthGateView
  app/               hooks e layout do shell (overlays, quota, atalhos, painéis, rotas lazy)
  useCockpit.ts      bomba de mensagens do WS; os domínios saem em hooks (useTerminals, useNotes…)
  cockpit/           estado do cliente fatiado (session, history, blocks, live-tokens…)
  components/primitives/  design system (Button, Badge, Icon, tokens) — galeria em /ds
  components/auth/   SupabaseAuthGate, Dashboard (pareamento + banner trusted-relay)
  routes/            uma tela por rota (ver a lista de rotas no README)
server/              backend Node/TS (roda local na VPS; e é a base do agent)
  index.ts           entry do backend local (:7777, /healthz, serve SPA buildada)
  agent.ts           AGENT T3: disca pro relay, health checks embutidos
  ws/                protocolo: serve-connection, runs, broadcast, authz, dispatch...
  engine/, sessions/ engine que fala com o claude CLI
relay/               relay T3 (roteador WS) — projeto isolado, sem driver de DB
  src/index.ts       createRelay(): paths /ws e /agent, /pair/new (CORS), heartbeat
  src/verify.ts      JWKS, validateClaims, verifyAgentSignature (Ed25519)
  src/store.ts       adapter Supabase (service-role) p/ agentes e códigos de pareamento
  src/routing.ts     Registry por conta (sem fan-out global)
  src/throttle.ts    janela deslizante em memória (rate limit do /pair/new)
  src/main.ts        entry runnable (lê env, listen 127.0.0.1)
  deploy/            Caddyfile, deck-relay.service (systemd endurecido), README
run-backend.sh       supervisor do backend local (:7777)
run-agent.sh         supervisor do agent (disca pro relay)
scripts/doctor.sh    watchdog do host (cron)
```

## Deploy

- **SPA**: Vercel, projeto `cockpit`. Build command = `vite build`. Env (Production):
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WS_URL=wss://deck-relay.devfellowship.com/ws`.
  Deploy via `vercel --prod --token=$VERCEL_TOKEN` (NUNCA interativo — login interativo trava a box).
- **Relay**: VPS dedicada. Caddy faz TLS (`deck-relay.devfellowship.com → 127.0.0.1:8800`),
  systemd `deck-relay.service` roda `npx tsx relay/src/main.ts`. Env em `.env.relay`
  (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COCKPIT_ROOT_EMAILS`, `RELAY_PORT`). DNS Cloudflare grey-cloud.
- **Agent**: na VPS do usuário. Caminho do fellow = `scripts/agent-setup.sh` (o one-liner que o
  Dashboard mostra junto do código de pareamento): instala deps + Claude CLI, pareia com
  `--pair=CÓDIGO`, sobe unit systemd `deck-agent` com `DECK_AGENT_ROLE=student` (default).
  Requer o `claude` CLI **logado** na box — o setup não faz o login. `run-agent.sh` é o
  supervisor da box do Samuel (path e `DECK_AGENT_ROLE=admin` fixos): não é o caminho do fellow.

## Modelo de segurança (estado atual)

- **Trusted-relay beta**: hoje o relay é operado pela DevFellowship e tecnicamente VÊ o tráfego
  (encaminha, mas poderia ler). A UI mostra um banner avisando. Concretamente, passam em claro
  pelo relay: o texto do chat, `upload-chunk` (bytes do anexo) e `admin-env-set` (nome E valor
  do token que o admin cola no painel — só admin manda isso, então hoje é exposição do próprio
  Samuel, não de fellow). O JWT viaja na query string do WS (`?token=`) porque browser não manda
  header no handshake: o Caddyfile do relay NÃO pode ganhar diretiva `log` sem redigir a query.
- **T5 (assinatura e2e dos frames)**: NÃO construído. É **fast-follow obrigatório** antes de
  abrir pra VPS de **terceiros** (relay não poder forjar comandos). Pro público interno (relay
  operado pela DFL, banner ligado) é aceitável; pro externo é gate.
- **Co-location**: rodar o relay na MESMA box do backend é aceito só pro teste pessoal single-user.
  Antes de DFL/fellows: VPS separada pro relay + T5 ligado.
- **Papel `student` NÃO é sandbox do LLM.** Ele limita a superfície do *Deck*: sem `term-*` (PTY
  cru, fora do permission-model do CLI, fora do reaper/health guard), sem `admin-*` (escreve
  `~/.claude.json`, `~/.deck-agent/env.json`, instala CLI, reinicia), sem bypass, sem metadados de
  sessão alheia. Em `auto`/`acceptEdits` o `claude -p` do fellow tem Bash/Write **na própria box**
  (`config.ts` allow-lists), e `Write` sem restrição de path alcança hooks de
  `~/.claude/settings.json` (rodam fora de `allowedTools`) e o `~/.claude.json`. Tirar Bash da
  allow-list seria teatro. A contenção real é **um processo/HOME por conta** (`server/auth.ts`).
- **Isolamento entre contas** é por construção no T3 (um agente por conta; `relay/src/routing.ts`
  só entrega pro bucket da conta) e travado em CI por `relay/integration.test.ts` ("two live
  agents… never cross accounts"). Um processo servindo duas contas quebraria isso — não existe.
- **Gates que o código impõe por papel** (agente): bypass (`bypassAllowed`, 4 condições), MCP stdio
  só pra admin (`pickMcpDefs` — student só carrega server remoto), item de fila de admin só sai pela
  mão de admin (`parked.ts`), teto de gasto por run do servidor (`COCKPIT_MAX_BUDGET_USD`, o cliente
  só aperta).

## Abrir pra outras contas — estado e gates (2026-09-02)

O modelo multi-conta **já é o T3**: cada pessoa cria conta (signup aberto no SPA), pareia um agente
na própria box e roda o `claude` logado na própria conta Anthropic. Não existe "ligar o login" no
modo listen — o listen é o dono da box, sempre `admin`.

**Público interno (fellows DFL, box própria)** — falta:
1. `scripts/agent-setup.sh` endurecido (recusar root, watchdog e hooks de auto-redeploy opt-in,
   sem reescrever crontab, `flock`, avisar que o `claude` precisa estar logado antes de daemonizar).
2. Relay em produção atualizado com a main (deploy manual, `relay/deploy/README.md`).
3. Decidir quem vira `admin` de conta: `accounts-list` devolve o e-mail de TODAS as contas pra
   qualquer `admin`, não só root (`relay/src/store.ts`).
4. **Ligar "Confirm email" no Supabase `deck-relay` — e isto é o que protege, não o código.**
   `roleFromIdentity` (`shared/identity.ts`) exige `email_verified` pra conceder root ou admin,
   lendo o claim de topo ou o `user_metadata` (`emailVerified` em `relay/src/verify.ts`). **Mas o
   GoTrue com autoconfirm (Confirm email OFF) já cria a conta confirmada**, então o claim vem
   `true` e o gate deixa passar. Ou seja: com a confirmação desligada, quem souber um e-mail da
   allowlist `COCKPIT_ROOT_EMAILS` ainda se cadastra com ele e vira root. A checagem no código é
   defesa em profundidade — cobre o caso "sessão existe sem e-mail confirmado" e impede o relay de
   confiar cegamente no claim —, **não substitui ligar a confirmação no projeto**. Enquanto o
   cadastro for aberto e a confirmação estiver off, `COCKPIT_ROOT_EMAILS` é um segredo.
5. SMTP próprio no `deck-relay` e `<origem>/?reset=1` na lista de Redirect URLs. O app já tem
   "esqueci a senha", mas o SMTP embutido do Supabase só manda pra membros do projeto e com teto
   de poucos e-mails por hora — sem SMTP, o fellow que esquecer a senha continua trancado fora.
6. Aplicar `migrations/relay/0004_account_prefs.sql` (coluna `prefs`): sem ela o sync de
   preferências falha calado e cada aparelho segue com as suas.

**Público externo / patrocinado (Centelha: pessoa sem box própria)** — bloqueado por:
1. **Isolamento é infra, não código**: agente hospedado por terceiro exige container/VM por conta
   com HOME, `~/.claude` e login próprios. O engine zera `ANTHROPIC_API_KEY` e força o OAuth da box
   (`claude.ts` `minimalEnv`), então um agente hospedado gasta a assinatura de *alguém* — de quem é
   a conta Anthropic de um aluno patrocinado é decisão de política, não de código.
2. **T5** (assinatura e2e dos frames).
3. Teto de custo por conta: `COCKPIT_MAX_BUDGET_USD` por processo cobre o run; quota do plano
   (`quota.ts`) é reativa ao sinal do CLI, não um orçamento. Orçamento por aluno = infra + política.
4. Instalador `curl | bash` de repo pessoal não serve pra terceiro: publicar artefato versionado
   com checksum.

## Build / test / verificação

```
npx tsc --noEmit                       # SPA
npx tsc --noEmit -p tsconfig.server.json
npx tsc --noEmit -p tsconfig.relay.json
npx vitest run                         # testes (ao lado dos arquivos: *.test.ts)
npm run build                          # os três typechecks + vite build
```
Testes ficam **ao lado** do arquivo testado (ex.: `relay/src/throttle.ts` + `relay/src/throttle.test.ts`).
O relay é provado ponta-a-ponta por `relay/integration.test.ts` (browser↔relay↔agent real, sem rede
externa), que também instala um listener de `unhandledRejection` como asserção — é assim que a
invariante "falha do store não derruba o processo" fica travada.
`relay/boundary.test.ts` garante a fronteira: nenhum arquivo do relay importa nada capaz de spawnar.

CI: job `gate` (typecheck + `vitest run`) e job `smoke` (playwright + `vite build`) a cada PR.
