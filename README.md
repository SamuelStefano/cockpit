# cockpit

> Painel web pessoal pra conversar com o Claude e operar terminais da VPS — em tempo real, com contexto que evolui a cada conversa.

Substitui o CLI do tmux por uma UI limpa: chat à esquerda, sessões salvas, terminais ao vivo à direita.

---

## A ideia

Um **cockpit dev** único pra:

- **Conversar com o Claude** numa UI boa (markdown, streaming, parar resposta).
- **Ver e controlar terminais/tmux** da VPS sem decorar comandos.
- **Salvar e evoluir contexto** — cada conversa aprimora a memória do projeto.
- Tudo **em tempo real**, acessível do desktop ou do celular.

---

## Motor

- **`claude -p` headless** no plano **Pro** → custo zero.
- Streaming via `--output-format stream-json --include-partial-messages`.
- Continuidade com `--resume <session_id>`.
- Sessões persistidas como **JSONL** em `~/.claude/projects/...` (fonte da verdade).

---

## Tempo real

- **WebSocket** multiplexado pro fluxo de terminais (xterm.js + node-pty).
- **Stream** dos eventos do Claude direto na UI (tokens conforme chegam).
- Terminais via `tmux new-session -A` → **sobrevivem** a restart do backend.
- Indicadores de conexão (ws/sse) visíveis no header.

---

## Segurança

- **Acesso só via Tailscale** — zero porta pública exposta.
- Terminais e o `claude` rodam como usuário **sem sudo** (`agentrun`).
- A VPS guarda segredos e dados de produção → o painel **nunca** vira shell-as-a-service aberto.
- Gate de segurança é a **Fase 0** do build, antes de qualquer feature.

---

## Contexto que evolui

- **JSONL** = histórico bruto (read-only).
- **SQLite** = índice, estado do tmux, cursor por device.
- **Memória markdown** = contexto curado que melhora a cada conversa.

---

## Stack

`Vite` · `React 18` · `TypeScript` · `Tailwind v3` · fontes `Geist` / `Geist Mono`
Backend: `Node` · `TypeScript` · `ws` · `tsx`. Bind `127.0.0.1:7777` (acesso via Tailscale).

Paleta: base `neutral-900`, acento `orange-500`, status verde/vermelho/amarelo.

---

## Rodar

**Dev** (frontend + backend juntos, hot-reload):

```bash
npm install
npm run dev          # vite :5173  +  backend :7777 (proxy /ws)
```

**Produção** (porta única, ideal pra Tailscale):

```bash
npm run build        # typecheck (web+server) + bundle em dist/
npm run serve        # http://127.0.0.1:7777 serve a UI e o WS
```

O backend roda `claude -p` em `--permission-mode plan` (sem bypass) e lê as
sessões do CLI direto do JSONL. Sobrescrevíveis por env: `COCKPIT_PORT`,
`COCKPIT_WORKDIR`, `COCKPIT_PERMISSION_MODE` (`plan`|`default`|`acceptEdits`).

---

## Roadmap

1. **Fase 0** — gate de segurança (usuário sem sudo, Tailscale).
2. **Fase 1** — chat-first: engine `claude -p` + streaming real.
3. **Fase 2** — terminais ao vivo (tmux + WebSocket).
4. **Fase 3** — contexto que evolui (memória + índice).
