# Deck

> Interface web pro **Claude CLI** que roda na sua própria máquina. Chat, terminais
> ao vivo e contexto que evolui — do desktop ou do celular.

O cérebro não fica num servidor nosso: é o binário `claude -p`, logado na **sua**
conta, rodando na **sua** VPS. Cada pessoa traz a própria máquina e a própria
assinatura, então o custo por usuário é plano.

Topologia, protocolo e modelo de segurança em detalhe: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## O que dá pra fazer

- **Conversar com o Claude** com streaming, markdown, parar/retomar resposta.
- **Operar terminais** da VPS (tmux + xterm.js) sem decorar comando.
- **Salvar e evoluir contexto** — sessões, notas, skills e docs viram memória do projeto.
- Painéis de **uso/custo**, **crons**, **pontos**, **grafo** do repo e um **design system** vivo.

Rotas: `/` `/contextos` `/skills` `/notas` `/pontos` `/crons` `/uso` `/graph`
`/harness` `/admin` `/docs` `/ds` `/play`.

---

## Dois modos de rodar

**Local** — backend na sua máquina, você acessa direto (Tailscale/loopback). É o
modo mais simples e não depende de nada externo.

**Remoto (T3)** — a SPA fica na Vercel, um **relay** roteia os frames por conta, e
um **agent** na sua VPS disca pro relay. Serve pra abrir o Deck do celular sem expor
porta nenhuma da sua máquina. O relay **não spawna nada** e roteia por `accountId`
derivado do JWT no servidor — nunca por dado vindo do frame.

---

## Rodar local

```bash
npm install
npm run dev          # vite :5173 + backend :7777 (proxy /ws)
```

Produção em porta única:

```bash
npm run build        # typecheck (web + server + relay) + bundle em dist/
npm run serve        # http://127.0.0.1:7777 serve a UI e o WS
```

O backend roda `claude -p` em `--permission-mode plan` por padrão e lê as sessões do
CLI direto do JSONL em `~/.claude/projects/…` (fonte da verdade). Configuração em
`.env` — veja **[.env.example](.env.example)** para a lista completa; o essencial é
`COCKPIT_PORT`, `COCKPIT_WORKDIR` e `COCKPIT_PERMISSION_MODE`
(`plan` | `default` | `acceptEdits`).

`--dangerously-skip-permissions` fica atrás de `COCKPIT_ALLOW_BYPASS` **e** de papel
admin **e** de acesso local: default-deny, desligado salvo decisão explícita.

Se a SPA for servida separada do backend, aponte o WS no build:
`VITE_WS_URL=wss://maquina.tailnet.ts.net/ws`.

---

## Stack

`Vite 5` · `React 18` · `TypeScript 5` · `Tailwind 3` · fontes `Geist` / `Geist Mono`
Backend: `Node` · `tsx` · `ws` · `node-pty` · `better-sqlite3`. Bind `127.0.0.1:7777`.
Auth do modo remoto: `Supabase` (JWT verificado por JWKS no relay).

Base `neutral-900`, acento `orange-500`. Os primitivos de UI vivem em
`src/components/primitives` e têm galeria viva em `/ds` — veja
[CLAUDE.md](CLAUDE.md) antes de escrever tela nova.

---

## Verificar

```bash
npx tsc --noEmit                          # SPA
npx tsc --noEmit -p tsconfig.server.json  # backend + agent
npx tsc --noEmit -p tsconfig.relay.json   # relay
npx vitest run                            # suíte completa
npx vite build
```

Teste fica **ao lado** do arquivo testado (`x.ts` + `x.test.ts`). O CI roda o mesmo
`gate` (typecheck + testes) mais um `smoke` de UI a cada PR.

---

## Persistência

- **JSONL** (`~/.claude/projects/…`) — histórico bruto do CLI, read-only.
- **SQLite** — índice das sessões, estado do tmux, cursor por device.
- **Markdown** — contexto curado que melhora a cada conversa.
