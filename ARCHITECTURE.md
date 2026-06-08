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
  timeout de socket pré-auth (15s) e cap de tentativas — defesa contra exaustão.

## Layout do repositório

```
src/                 SPA React (deploy Vercel)
  App.tsx            gate de login (Supabase) → Dashboard/Cockpit
  useCockpit.ts      estado do cliente WS
  cockpit/session.ts wsBase / buildWsUrl / relayHttpBase (deriva do VITE_WS_URL)
  components/auth/    SupabaseAuthGate, Dashboard (pareamento + banner trusted-relay)
  routes/            Admin, Contextos, Docs, Skills, Observatorio
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
- **Agent**: na VPS do usuário. `--pair=CÓDIGO` (uma vez) → depois roda em loop via `run-agent.sh`
  com `DECK_RELAY_URL=wss://deck-relay.devfellowship.com`. Requer o `claude` CLI logado na box.

## Modelo de segurança (estado atual)

- **Trusted-relay beta**: hoje o relay é operado pela DevFellowship e tecnicamente VÊ o tráfego
  (encaminha, mas poderia ler). A UI mostra um banner avisando.
- **T5 (assinatura e2e dos frames)**: NÃO construído. É **fast-follow obrigatório** antes de
  abrir pra VPS de **terceiros** (relay não poder forjar comandos). Enquanto for só o Samuel na
  própria box, o risco é **bounded-to-self** (único usuário, confia na própria infra) — aceitável só nesse escopo.
- **Co-location**: rodar o relay na MESMA box do backend é aceito só pro teste pessoal single-user.
  Antes de DFL/fellows: VPS separada pro relay + T5 ligado.
- Role do engine no agente do fellow = `student` (chat/sessões/contexts; **sem** term-*/bypass/admin).

## Build / test / verificação

```
npx tsc --noEmit                       # SPA
npx tsc --noEmit -p tsconfig.server.json
npx tsc --noEmit -p tsconfig.relay.json
npx vitest run                         # testes (ao lado dos arquivos: *.test.ts)
npm run build                          # build da SPA (vite)
```
Testes ficam **ao lado** do arquivo testado (ex.: `relay/src/verify.ts` + `relay/verify.test.ts`).
O relay é provado ponta-a-ponta por `relay/integration.test.ts` (browser↔relay↔agent real, sem rede externa).
