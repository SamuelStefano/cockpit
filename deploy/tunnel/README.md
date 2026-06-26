# Túneis on-demand (VPS ↔ desktop)

Dá ao agente do Deck (na VPS) autonomia pra **solicitar túneis temporários** até um
serviço local do desktop (atrás de NAT). Primeiro consumidor: **Obsidian Local REST
API (MCP)**. Plano: `20260626-deck-on-demand-tunnels`.

## Por que o desktop é quem abre

O desktop está atrás de NAT — a VPS nunca disca pra ele. Então o agente só **registra
um pedido** numa fila local; um daemon no desktop faz poll (via SSH), abre o túnel
**reverso** (`ssh -R`) e marca `ready`. O dado trafega cifrado pelo SSH.

```
[VPS] agente                                  [desktop] deck-tunnel-daemon
  deck-tunnel request obsidian  ── fila ──▶   poll ~3s:  ssh vps 'deck-tunnel relay' (SSH_ORIGINAL_COMMAND=pop)
  (bloqueia até ready/timeout)                 abre:      ssh -N -R 127.0.0.1:PORT:127.0.0.1:27123 vps
  ◀── ready ──────────────────────────────     marca:     ssh vps 'deck-tunnel relay' (…=ready <id> PORT)
  claude mcp add http://127.0.0.1:PORT/mcp/    fecha sozinho após TTL
```

## Componentes (F1, VPS)

- `server/tunnel.ts` — fila (arquivos JSON em `~/.deck-agent/tunnels/`) + fronteira
  `parseRelayCommand` (só pop/ready/list/hold).
- `server/tunnel.cli.ts` — CLI `deck-tunnel` (`request`/`list`/`close`/`relay`).
- `scripts/deck-tunnel` — wrapper instalado em `~/.local/bin/deck-tunnel`.

## Confiança

- **`authorized_keys.example`** — chave do desktop travada: `restrict` (sem shell/
  forward local) + `permitlisten="127.0.0.1:*"` (só `-R` no loopback) + forced-command
  `deck-tunnel relay`. O desktop **não** consegue `request`/`close` nem rodar comando
  arbitrário.
- **`sudoers-deck-tunnel`** — autonomia escopada a `systemctl deck-tunnel*`. O caminho
  loopback **não exige root**; o sudoers só serve se algum serviço passar a ser exposto.

## Segurança

- Túnel de dados só existe durante o uso (**TTL**, default 600s, máx 3600s).
- Bind **sempre** em `127.0.0.1` da VPS — relay e terceiros não alcançam.
- `hold` server-side limita a vida da conexão de dados mesmo se o desktop não matar.

## Pendente

- **F2:** `scripts/desktop-tunnel-setup.sh` + daemon (Win/Mac/Linux) — Samuel roda.
- **F3:** validar ponta-a-ponta com o Obsidian.
