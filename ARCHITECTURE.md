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

1. **Browser / SPA** (`src/`): React 19 + Vite 8 + TS + Tailwind 4. Deploy na **Vercel**.
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
  Com `COCKPIT_ROOT_USER_IDS` (CSV de UUIDs) não vazio, root exige e-mail na allowlist **e** `sub`
  na lista: quem se cadastra com e-mail root mas outro id cai pra admin/fellow.
- **Origem e limites**: `DECK_ALLOWED_ORIGINS` (CSV de origens exatas) barra no upgrade de `/ws` e
  `/agent` qualquer `Origin` fora da lista (sem `Origin` passa: agente não é browser) e só reflete
  origens listadas no CORS de `/pair/new`; vazio = qualquer origem (aviso no boot). Teto de
  sockets por IP (`DECK_MAX_SOCKETS_PER_IP`, 64; IP = último `X-Forwarded-For` se o peer é loopback)
  e de abas por conta (`DECK_MAX_TABS_PER_ACCOUNT`, 20; a nova fecha 4429). Frame de agente
  > 16 KB antes da auth fecha 4413.
- **JWT no WS**: o cliente oferece `['deck.v1', 'bearer.<JWT>']` em `Sec-WebSocket-Protocol`; o relay
  seleciona `deck.v1` e lê o token do `bearer.`. `?token=` segue como fallback (clientes antigos) e
  perde pro subprotocolo; ele vaza no access log do Caddy, então o SPA deve migrar.
- **Agent → relay**: handshake **Ed25519 challenge-response**. O agente manda `agent-hello`
  com seu `agentId`; o relay devolve um `challenge` (nonce); o agente assina `nonce.agentId`
  com a privada; o relay verifica contra a pubkey guardada no Store. (`relay/src/index.ts` path `/agent`.)
- **Pareamento**: o browser logado faz `POST /pair/new` → relay gera um código single-use/TTL.
  O usuário roda o agente com `--pair=CÓDIGO`; o agente apresenta código+pubkey; o relay
  consome o código (atômico) e registra o `agentId`. (`pairAgent` em `server/agent-main.ts`.)
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
   abas daquela conta que estão naquele box (`registry.toBrowsers`). Escopo é **por conta e
   por box** o tempo todo.

### Vários boxes por conta (multi-box)

Uma conta pareia até `DECK_MAX_BOXES_PER_ACCOUNT` (10) máquinas — cada uma é uma linha
`agent` (kind `vps`) com `label`. Cada box tem o seu slot no relay; um segundo box não
derruba o primeiro. A aba escolhe o box no handshake (`/ws?box=<agentId>`): o relay só
resolve esse id **dentro da conta do JWT** (de outra conta = offline). Sem `?box`, a aba
segue o **primário** (o box online há mais tempo) — é o caminho de cliente antigo e de
conta com um box só, sem mudança. Se o primário cai e outro assume, essas abas fecham com
`4003` e redisca (o canal selado era com o outro box).

- Frames de um box só chegam às abas daquele box; frame selado dirigido exige mesma conta
  **e** mesmo box; presença (`browsers-present`/`no-browsers`) e `canBypass` são por box.
- O relay manda `{t:'boxes', box, primary, boxes:[{id,label,online,lastSeen}]}` às abas da
  conta (nunca aos boxes) e trata `box-rename`/`box-revoke` ele mesmo, com filtro
  `id` + `account_id` no banco. Revogar corta o socket do box na hora.
- Rótulo saneado (controle e bidi fora, ≤ 64) no relay e no banco (migration 0007).

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
  - **Self-update** (`server/self-update.ts`): 1 min depois do boot e a cada ~10 min (+ jitter), no
    clone de onde o agente roda: `git fetch origin main` e, só se o clone está na `main`, sem mudança
    local rastreada, sem `core.hooksPath` (hooks de auto-redeploy armados mandam no clone) e atrás da
    `origin/main` por fast-forward, `git merge --ff-only` (hooks e fsmonitor desligados). Mudou
    `package.json`/`package-lock.json` → `npm ci`; falhou → `git reset --hard` pro commit anterior,
    `npm ci` de novo e aquele commit não é tentado de novo. Espera não haver turno rodando (máx.
    30 min; depois reinicia assim mesmo pelo caminho `preserveLive`, e os turnos retomam no boot) e
    sai; systemd (`Restart=always`) ou o loop do nohup (`DECK_SUPERVISED=1`) sobe o código novo.
    Sem supervisor que o traga de volta, não atualiza.
    **Rollback de main quebrada** (`server/self-update-boot.ts`): antes de sair, grava
    `~/.deck-agent/self-update.json` `{from, to, boots: 0}`. Cada boot com HEAD = `to` conta um; o
    boot que acha 3 já contados faz `git reset --hard <from>` (+ `npm ci` se as deps mudaram), põe
    `to` em `self-update-bad.json` (nunca tentado de novo), apaga o marcador, loga
    `[agent] self-update: <to> failed to boot 3x, rolled back to <from>` e segue no código antigo no
    mesmo processo. O update vira bom (marcador apagado) com 2 min no ar E uma conexão ao relay;
    até lá nenhum update novo começa. O check roda em `server/agent.ts`, o entrypoint das units, que
    só importa builtins + `self-update-boot.ts` e carrega `agent-main.ts` por `import()` dinâmico: o
    ESM linka o grafo estático inteiro antes de rodar qualquer linha, então um import quebrado não
    pode impedir o check. Esses dois arquivos têm que continuar sem imports do app. Unit:
    `StartLimitBurst=10` em 300 s, `RestartSec=5` (o rollback precisa de 4 starts; units antigas
    com burst 5 ainda cabem). `DECK_SELF_UPDATE=off` desliga. **Confiança**:
    a fonte é o mesmo repositório GitHub de onde a box foi instalada (nenhuma raiz nova); nada vindo
    do relay inicia, pula ou direciona uma atualização.
- **Saúde da máquina** (`server/box-health.ts`, julgamento puro em `shared/box-health.ts`): no
  bootstrap de cada aba, a cada 5 min com aba aberta e sob pedido (`box-health-get`), o agente manda
  `agent-health` (sempre por `broadcast`/`send`, ou seja, dentro do canal selado) com ok/warn/error +
  dica de correção para: CLI do claude (path, versão e as flags que todo turno usa, checadas no
  `--help`), login, código do agente (sha, atrás da main), self-update, Node, node-pty, disco livre e
  aparelhos. Cada sonda tem timeout; o relatório fica em cache por 60 s. `box-smoke-test` roda um
  prompt real (haiku, plan) pelo mesmo `run()` dos chats, com cwd em `~/.cockpit/smoke` (não vira
  chat), e devolve o erro real mapeado para uma dica. No navegador: selo por máquina no seletor,
  painel "Saúde da máquina", toast quando um item vira erro e checklist de pareamento
  (`src/cockpit/setup-watch.ts`) que vai de "aguardando a máquina" até "prompt de teste respondeu".
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
  useCockpit.ts      bomba de mensagens do WS; os domínios saem em hooks (useTerminals, usePoints…)
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

- **Canal selado navegador↔agente (T5, `shared/e2e/`, `server/e2e/`, `src/cockpit/sealed-socket.ts`).**
  O relay deixou de ser confiável: ele roteia, mas não lê, não forja e não reenvia frame.
  - **Aparelho cadastrado**: cada navegador gera uma chave Ed25519 **não-extraível** (IndexedDB).
    O agente só aceita aparelhos de `~/.deck-agent/devices.json`, escrito só na própria box.
  - **Cadastro fora do relay**: `deck-agent enroll-device` mostra um código de uso
    único (10 min) com o fingerprint da chave do agente + um segredo de 128 bits. O segredo
    autentica (HMAC) a chave do aparelho e a resposta do agente: o relay não troca nenhuma das duas.
    Um aparelho já cadastrado também gera código (`device-code-new`, dentro do canal selado).
    `deck-agent` é um wrapper que o `agent-setup.sh` instala (`/usr/local/bin` com root/sudo, senão
    `~/.local/bin`, e sempre `$SRC_DIR/bin`) com usuário do serviço, clone, `DECK_AGENT_DIR`, relay e
    PATH gravados (`printf %q`): roda como o usuário do serviço (re-exec por `sudo -u`/`runuser`) e só
    aceita `enroll-device`, `devices` e `revoke-device <prefixo>`. Esses três não falam com o relay e
    não exigem `DECK_RELAY_URL`.
  - **Chave por passkey (PRF)** (`shared/e2e/passkey.ts`, `src/cockpit/passkey.ts`): com passkey
    da conta (credencial descobrível, `rpId` = host da SPA, verificação de usuário obrigatória), a
    saída PRF (sal fixo `deck-e2e-device-v1`) vira por HKDF a chave Ed25519 do aparelho (importada
    não-extraível) e um `pinRoot` (chave HKDF não-extraível). Todo navegador onde a passkey
    sincroniza deriva a mesma chave: a box confia uma vez. Sem PRF, segue a chave aleatória de sempre.
    Navegador já cadastrado com a chave aleatória **migra sem comando**: ao destravar a passkey, ele
    manda dentro do canal selado `device-add-passkey {pub, label, box, key}` (mesma checagem de box
    do `device-pin`) e a box passa a confiar na chave passkey com o pin key dela, numa escrita só.
    Box por box: cada uma que o navegador fixou com a chave aleatória recebe a chave passkey quando
    o canal com ela abre (`passkey-boxes` no IndexedDB diz com qual chave discar cada box). O Deck
    oferece a passkey sozinho num aviso dentro do app enquanto não houver uma ativa.
  - **Pin do agente por prova**: o navegador entrega à box, dentro do canal selado e só num socket
    preso à box (`?box=`), `boxPinKey = HKDF(pinRoot, "box-pin" ‖ boxId)`, guardada em
    `devices.json` junto do aparelho (revogar apaga). No handshake a box manda
    `pin = HMAC(boxPinKey, PROTO ‖ "agent-pin" ‖ agentPub ‖ devicePub ‖ boxId)`; um navegador
    sem pin para aquela box só aceita a chave do agente se a prova bater para o `boxId` que ele
    discou. Chave por box: uma box comprometida não responde por outra. Navegador com pin ignora prova.
    O `device-pin` só sai para a box do socket e só se o slot dela guarda exatamente a chave do agente
    deste canal. Lista ocupada na box responde `device-pinned ok:false` sem derrubar o canal.
  - **Nenhum caminho troca um pin existente**: pré-autorização, prova, TOFU e código de cadastro só
    preenchem slot vazio. A única troca é o código digitado na tela que avisou "a chave mudou"
    (agente reinstalado).
  - **Pré-autorização no pareamento**: o comando de setup leva `DECK_DEVICE_CODE` (fingerprint da
    chave passkey + segredo de 128 bits, só por env); `--pair` guarda (10 min, mesmas travas dos
    códigos). O navegador manda `e2e-preauth` só de um socket preso a uma box cujo slot está vazio,
    nunca em reação a um `e2e-unknown-device` (que o relay pode forjar). Pedido e resposta levam o
    `boxId`: uma box para onde o relay desviou a discagem recusa sem queimar nada, e o grant dela não
    confere. Resgate idempotente: o mesmo aparelho pode resgatar de novo até expirar (o grant pode
    se perder no caminho); outro aparelho não; aparelho revogado não volta. Falha ou silêncio não é
    pegajoso: o navegador tenta de novo enquanto houver segredo pendente. O segredo pendente fica em
    `sessionStorage` (só esta aba), um por código de pareamento, por no máximo 10 min.
  - **TOFU na box sem aparelho** (`server/e2e/hub.ts`): com `devices.json` vazio ou ausente, o agente
    aceita o PRIMEIRO hello (qualquer chave), marca `tofu: true` no `e2e-accept` e grava o aparelho
    no confirm, sob a trava da lista. Uso único (o primeiro gravado fecha a janela, mesmo que a lista
    esvazie depois, até o agente reiniciar), aberta até o primeiro aparelho entrar (sem limite a
    partir do start: o self-update reinicia o agente e tornaria esse limite aleatório), log alto na
    box (`[agent] e2e: first device trusted on first use (<fp>…)`), desligado com `DECK_E2E_TOFU=off`.
    Fechado também enquanto houver pré-autorização viva na box (o navegador do dono está para entrar;
    TOFU só deixaria o relay entrar antes) e nunca depois de `TOFU_UNTIL` (`shared/e2e/tofu.ts`,
    10/11/2026), o mesmo corte que o navegador aplica. `devices.json` ausente = vazio; presente mas
    ilegível ou fora do formato = "tem aparelho" (sem TOFU) e nenhuma escrita o sobrescreve.
    O navegador só aceita `tofu: true` se não tem pin para aquela box, o socket está preso a ela e
    ainda é antes de `TOFU_UNTIL`.
  - **Handshake por aba**: X25519 efêmero dos dois lados, transcript assinado pelos dois (papéis
    separados), HKDF → AES-256-GCM com chave por direção. Sequência estritamente crescente: o relay
    pode descartar frame (backpressure), nunca reordenar nem repetir. Frame adulterado derruba o canal.
  - **Agente**: por padrão (`DECK_E2E` ≠ `off`) só serve canais selados; frame em claro do relay é
    descartado. `DECK_E2E=off` volta ao modo antigo e existe só pra recuperar uma box sem aparelho.
  - **Navegador**: só abre o app depois do canal; do relay em claro aceita só `agent-online`,
    `agent-offline` e `accounts`. Chave de agente diferente da fixada = tela "a chave mudou", nunca
    retry. Sem pin e sem prova, ou sem pin e com prova que não confere (nada guardado contradiz a
    chave; o relay pode pôr qualquer coisa no campo) = tela de cadastro, que segue tentando.
  - **Relay**: dá um id aleatório por aba, carimba no frame do navegador (último `"c"` vence) e
    entrega a resposta do agente só àquela aba, da mesma conta, sem o id.
  - **Só frame descartável pode sumir**: cada frame leva, cifrado, se é crítico e a sequência do último
    crítico antes dele. O relay só consegue descartar delta/thinking/stats; perder uma tecla, um `stop`
    ou uma negação quebra a cadeia e o canal.
  - **Chave própria**: o canal usa `~/.deck-agent/e2e-key.json`, não a chave que responde ao desafio
    de login do relay (o relay escolhe o desafio; a mesma chave viraria oráculo de assinatura).
  - Gestão: `deck-agent devices`, `deck-agent revoke-device <prefixo>`; dentro do canal,
    `devices-list`/`device-revoke` (lista no menu de perfil: nome, desde, visto por último, "este
    aparelho", revogar, "Esquecer esta VPS"). Revogar grava, na mesma escrita e trava de
    `devices.json`, uma lápide `{revoked: pub}` (sem `pub`, então um agente antigo só a descarta):
    `device-add-passkey` de outro navegador sincronizado e o TOFU recusam aquela chave. Só código de
    cadastro ou pré-autorização de pareamento limpam a lápide.
    O agente varre os canais a cada 10 s: aparelho revogado (até pela CLI) cai na hora, e todo canal
    se refaz em no máximo 12 h.
  - **Frames de dono (`shared/root-frames.ts`)**: o relay não vê mais o tipo do frame selado, então o
    filtro de root dele não vale para o canal. Quem decide é o agente: `DECK_AGENT_ROLE=admin` libera
    tudo para os aparelhos cadastrados na própria box (o dono).
  - **O que NÃO cobre**: quem controla o JS servido pela Vercel controla a ponta do navegador (CSP
    estrita reduz XSS, mas o deploy é raiz de confiança); o relay ainda vê metadados (tamanho, horário,
    conta) e pode derrubar a conexão.
    - **XSS e passkey**: o WebAuthn devolve a saída PRF ao JS, e o HKDF entrega a semente Ed25519 ao
      JS, então por um instante, no destravar, a semente (o `d` da chave) está na memória da página.
      O `exportKey('jwk')` que lê a chave pública dela não aumenta essa exposição (um Ed25519 em JS
      puro guardaria os mesmos bytes), e só a chave não-extraível fica guardada. Um XSS presente
      nesse instante leva a chave do aparelho de todo navegador da passkey, para sempre.
    - **XSS e `pinRoot`**: mesmo não-extraível, um XSS a qualquer hora deriva `boxPinKey` de qualquer
      box (persistente e válido em todo navegador da passkey). Revogar = revogar o aparelho passkey em
      **cada** box (menu de perfil ou `--revoke-device`) e criar uma passkey nova.
    - **Segredo pendente do pareamento**: legível por XSS na aba durante os 10 min.
    - **Janela TOFU**: até `TOFU_UNTIL`, enquanto um agente não tem aparelho nem pré-autorização
      pendente (a qualquer momento depois do start, não só nos primeiros minutos), quem disca primeiro vira dono, e isso inclui o relay (com uma chave
      dele, no lugar do navegador). O log alto e a lista de aparelhos mostram quem entrou;
      `DECK_E2E_TOFU=off` fecha a janela.
    - **TOFU forjado contra o navegador**: o `tofu: true` não é assinado. Até `TOFU_UNTIL`, um
      navegador sem pin para uma box aceita um "agente" do relay que diga `tofu`. Esse falso agente
      não alcança a box de verdade, mas o navegador fixa a chave dele e, sendo passkey, entrega a ele
      o `boxPinKey` daquela box dentro do canal (`device-pin`/`device-add-passkey`). Decisão de
      produto: o pin continua sendo entregue (sem ele, navegadores sincronizados de boxes migradas
      precisariam de código depois do corte). Consequência: um primeiro uso forjado compromete o canal
      daquela box **para aquela passkey** (todo navegador onde ela sincroniza, não só um), e isso
      **não acaba no corte**: com o `boxPinKey`, o relay forja a prova para qualquer navegador da
      passkey sem pin para a box, antes e depois de `TOFU_UNTIL`. Reset completo: "Esquecer esta VPS"
      em cada navegador (menu de perfil → aparelhos; apaga deste navegador o pin e a marca passkey da
      box) **e** criar uma passkey nova (outro `pinRoot`: o `boxPinKey` vazado não vale para ela);
      na box, revogar o aparelho passkey antigo. Só esquecer, sem passkey nova, não basta.
    - **Box comprometida + relay**: com discagem desviada para uma box comprometida que se diz outra,
      um navegador que nunca fixou a box dialada pode entregar a ela o `boxPinKey` daquela box.
- **Co-location**: rodar o relay na MESMA box do backend é aceito só pro teste pessoal single-user.
  Antes de DFL/fellows: VPS separada pro relay + T5 ligado.
- **Papel `student` NÃO é sandbox do LLM.** Ele limita a superfície do *Deck*: sem `term-*` (PTY
  cru, fora do permission-model do CLI, fora do reaper/health guard), sem `admin-*` (escreve
  `~/.claude.json`, `~/.deck-agent/env.json`, instala CLI, reinicia), sem bypass, sem metadados de
  sessão alheia. Em `auto`/`acceptEdits` o `claude -p` do fellow tem Bash/Write **na própria box**
  (`config.ts` allow-lists), e `Write` sem restrição de path alcança hooks de
  `~/.claude/settings.json` (rodam fora de `allowedTools`) e o `~/.claude.json`. Tirar Bash da
  allow-list seria teatro. A contenção real é **um processo/HOME por conta** (`server/auth.ts`).
- **Perfil travado (`restricted`) de bot da Equipe** (fatia E, `server/engine/restricted-profile.ts`,
  aplicado em `profilePermissions` no `claude.ts`). Bot salvo por não-admin é sempre travado
  (`ws/student-team.ts`), e turno de bot puxado por não-admin roda travado mesmo que o `team.json`
  diga `full` (`botTurnFor`). Num turno travado:
  - `cwd` = `~/.cockpit/bots/<id>/workspace` (`COCKPIT_BOTS_DIR`), criado sob demanda com 0700.
  - CLI com `--restricted` + `--tools AskUserQuestion Edit Glob Grep Read TodoWrite WebFetch WebSearch Write`:
    Bash/Monitor/Agent/NotebookEdit nem existem na sessão, e o `--restricted` do CLI prende Read/Edit/
    Write/Glob/Grep aos diretórios de trabalho e ignora settings de usuário/projeto/local (hooks do
    `~/.claude/settings.json` e um `.claude/settings.json` plantado no workspace não carregam).
    `--allowedTools` só libera `Edit|Write|Read(//<workspace>/**)`; `--disallowedTools` repete Bash & cia.
  - Modo: `plan` fica `plan`; todo o resto (auto, acceptEdits, bypass pedido) vira `default`.
    O permission MCP sobe com `--restricted` (nunca `--allow-all`): tool fora da allow-list é negada.
  - MCPs da sessão e o sentinel `*` são ignorados: sobem só `deck-permission` (travado) e `deck-team`
    (`team_list`/`team_send` entram no allow). O bot fala com a equipe só pelo MCP; outbox, log, pause
    e `team.json` ficam em `~/.cockpit`, fora do workspace, e as file tools não alcançam. Mensagem da
    equipe que acorda um bot travado leva o `profile` junto (`ws/team-deliver.ts`).
  - Modelo `agent:` (ACP) recusado no save (`validateBotInput`) e no turno (`startRun`): o ACP tem
    loop de tools próprio, fora destas regras.
  - O transcript continua no `projectsDir` do Deck via `CLAUDE_CONFIG_DIR` + `CLAUDE_CODE_PROJECT_DIR_NAME`
    (o CLI 2.1.309 só honra o segundo com o primeiro setado); auto-memory desligada.
  - Verificado ao vivo (CLI 2.1.309, HOME temporário): `Read(~/.claude.json)`, `Write(~/.claude/settings.local.json)`,
    `Grep` no HOME, `Read(/etc/hostname)`, Bash e `Write(<workspace>/.claude/settings.json)` negados;
    escrita no workspace e `--resume` funcionam. Com a fatia B: `team_list`/`team_send` funcionam e
    `Write` em `team-outbox/`, `team-paused.json` e `Read` em `team-messages.jsonl` são negados.

  **O que o perfil travado NÃO garante:** não é sandbox de SO — o processo `claude` roda com o mesmo
  usuário Unix e a garantia é a do enforcement do CLI (uma regressão do `--restricted`/`--tools` numa
  versão nova abre tudo; o teste ao vivo precisa ser refeito a cada salto de versão). `WebFetch`/
  `WebSearch` ficam ligados: o bot pode exfiltrar o que leu do workspace e alcançar URL de loopback/
  rede interna (SSRF de GET). Symlink já existente dentro do workspace não foi testado. Parked/live-runs
  carregam o `profile` do momento em que o turno foi enfileirado. O chat normal do student continua
  como antes (Bash/Write na própria box): o travado vale só para turno de bot. Mudar o bot de `full`
  pra travado não apaga o que ele já fez.
- **Isolamento entre contas** é por construção no T3 (um agente por conta; `relay/src/routing.ts`
  só entrega pro bucket da conta) e travado em CI por `relay/integration.test.ts` ("two live
  agents… never cross accounts"). Um processo servindo duas contas quebraria isso — não existe.
- **Gates que o código impõe por papel** (agente): Equipe do student só com bot travado e cron só de bot
  (`ws/student-team.ts`), bypass (`bypassAllowed`, 4 condições), MCP stdio
  só pra admin (`pickMcpDefs` — student só carrega server remoto), item de fila de admin só sai pela
  mão de admin (`parked.ts`), teto de gasto por run do servidor (`COCKPIT_MAX_BUDGET_USD`, o cliente
  só aperta).

## Abrir pra outras contas — estado e gates (2026-09-02)

O modelo multi-conta **já é o T3**: cada pessoa cria conta (signup aberto no SPA), pareia um agente
na própria box e roda o `claude` logado na própria conta Anthropic. Não existe "ligar o login" no
modo listen — o listen é o dono da box, sempre `admin` no engine e `root` no caps (pontos e host-ops exigem root: `shared/root-frames.ts`, barrados também no relay pra conta não-root).

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

**Público externo / patrocinado (Centelha: pessoa sem box própria)** — bloqueado por (T5 já feito):
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
npm run build                          # os quatro typechecks (web, server, relay, monitor) + vite build
```
Testes ficam **ao lado** do arquivo testado (ex.: `relay/src/throttle.ts` + `relay/src/throttle.test.ts`).
O relay é provado ponta-a-ponta por `relay/integration.test.ts` (browser↔relay↔agent real, sem rede
externa), que também instala um listener de `unhandledRejection` como asserção — é assim que a
invariante "falha do store não derruba o processo" fica travada.
`relay/boundary.test.ts` garante a fronteira: nenhum arquivo do relay importa nada capaz de spawnar.

CI: job `gate` (typecheck + `vitest run`) e job `smoke` (playwright + `vite build`) a cada PR.
