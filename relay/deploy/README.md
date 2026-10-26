# Deploy do relay T3 (DR-023/024)

Roda numa **VPS isolada** (NÃO a box do DFL prod), usuário sem sudo/docker. O relay
só guarda material público (JWKS) + a service-role do projeto `deck-relay`; é
incapaz de spawnar (boundary.test). Caddy faz o TLS em :443 → relay em loopback.

## Caminho endurecido (atual)

O relay roda como o usuário `relay` (sem shell, sem sudo) um **bundle único**
(`/opt/deck-relay/main.mjs`, de root, só-leitura) com Node 22 oficial verificado por
checksum em `/opt/node22`. Env em `/etc/deck-relay/env` (`root:relay 0640`). Sem
`npx`, `tsx` nem `node_modules` no host. Caddy com admin em socket unix e logs sem
token.

```
relay/deploy/build.sh
ssh -i ~/.ssh/oracle_relay ubuntu@HOST 'mkdir -p /tmp/deck-relay'
scp -i ~/.ssh/oracle_relay relay/deploy/dist/* relay/deploy/{deck-relay.service,Caddyfile,harden-host.sh} ubuntu@HOST:/tmp/deck-relay/
ssh -i ~/.ssh/oracle_relay ubuntu@HOST 'sudo EXTRA_ENV="DECK_ALLOWED_ORIGINS=https://… COCKPIT_ROOT_USER_IDS=…" bash /tmp/deck-relay/harden-host.sh'
```

O script faz backup, sobe o relay novo e confere `/status` (rollback se falhar),
valida o Caddyfile antes de trocar (rollback se o HTTPS cair), corta a retenção do
journald (os logs antigos tinham JWT na URL), desliga rpcbind e X11/agent forwarding
do sshd (validado com `sshd -t`). Não mexe em firewall nem na porta 22.

Deploy seguinte = só `build.sh` + `scp` + o mesmo script (idempotente).
Conferir drift: `cat /opt/deck-relay/REVISION` contra `git rev-parse origin/main`.

## Caminho antigo (referência)

## 1. Provisionar (Samuel)
- VPS pequena (Hetzner CX22 / DO basic / Fly), distinta da box do prod.
- Usuário `relay` sem sudo, fora do grupo docker.
- DNS: `deck-relay.devfellowship.com` → IP da VPS.
- Firewall: **inbound 443 só** + SSH restrito (Tailscale/IP). `ufw default deny
  incoming; ufw allow 443; ufw allow <ssh> from <seu-ip>; ufw enable`.

## 2. Código + env
```
git clone <repo> /opt/deck-relay && cd /opt/deck-relay && npm ci
cat > /opt/deck-relay/.env <<EOF
SUPABASE_URL=https://ikxtdssxmcgipyfpwmar.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role do deck-relay (dashboard → API)>
COCKPIT_ROOT_EMAILS=samuelstefanodocarmo@gmail.com
COCKPIT_ROOT_USER_IDS=<uuid do usuário root no Supabase>
DECK_ALLOWED_ORIGINS=https://<origem do SPA>
# opcionais: DECK_MAX_SOCKETS_PER_IP (64), DECK_MAX_TABS_PER_ACCOUNT (20)
RELAY_PORT=8800
EOF
chmod 600 /opt/deck-relay/.env
```

## 3. Schema do `deck-relay`
Aplicar `migrations/relay/*.sql` em ordem no SQL Editor do projeto Supabase. Sem
isso não existem `account`/`agent`/`pairing_code`, e o relay sobe sem ter o que ler
(login entra, pareamento não fecha). Ordem, conteúdo e como conferir o que já está
aplicado: `migrations/README.md`.

## 4. Caddy + systemd
```
cp relay/deploy/Caddyfile /etc/caddy/Caddyfile   # ajuste o domínio
systemctl restart caddy
cp relay/deploy/deck-relay.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now deck-relay
```

## 5. Frontend (Vercel)
Setar no projeto do Deck:
- `VITE_SUPABASE_URL=https://ikxtdssxmcgipyfpwmar.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<anon key do deck-relay>`
- `VITE_WS_URL=wss://deck-relay.devfellowship.com/ws`
Redeploy. O app passa a mostrar login → dashboard de pareamento.

## 6. Parear sua VPS
Na sua VPS (com `claude` CLI logado): pegue o código no dashboard e rode
`DECK_RELAY_URL=wss://deck-relay.devfellowship.com npx tsx server/agent.ts --pair=CÓDIGO`,
depois `DECK_RELAY_URL=… npx tsx server/agent.ts` pra ficar online.

## Gate antes de VPS de TERCEIROS (DR-025)
e2e signing (T5) tem que estar enforced antes de uma VPS não-Samuel discar. Até lá o
dashboard mostra o banner "relay confiável · beta".
