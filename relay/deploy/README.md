# Deploy do relay T3 (DR-023/024)

Roda numa **VPS isolada** (NÃO a box do DFL prod), usuário sem sudo/docker. O relay
só guarda material público (JWKS) + a service-role do projeto `deck-relay`; é
incapaz de spawnar (boundary.test). Caddy faz o TLS em :443 → relay em loopback.

## 1. Provisionar (Samuel)
- VPS pequena (Hetzner CX22 / DO basic / Fly), distinta da box do prod.
- Usuário `relay` sem sudo, fora do grupo docker.
- DNS: `relay.devfellowship.com` → IP da VPS.
- Firewall: **inbound 443 só** + SSH restrito (Tailscale/IP). `ufw default deny
  incoming; ufw allow 443; ufw allow <ssh> from <seu-ip>; ufw enable`.

## 2. Código + env
```
git clone <repo> /opt/deck-relay && cd /opt/deck-relay && npm ci
cat > /opt/deck-relay/.env <<EOF
SUPABASE_URL=https://ikxtdssxmcgipyfpwmar.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role do deck-relay (dashboard → API)>
COCKPIT_ROOT_EMAILS=samuelstefanodocarmo@gmail.com
RELAY_PORT=8800
EOF
chmod 600 /opt/deck-relay/.env
```

## 3. Caddy + systemd
```
cp relay/deploy/Caddyfile /etc/caddy/Caddyfile   # ajuste o domínio
systemctl restart caddy
cp relay/deploy/deck-relay.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now deck-relay
```

## 4. Frontend (Vercel)
Setar no projeto do Deck:
- `VITE_SUPABASE_URL=https://ikxtdssxmcgipyfpwmar.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<anon key do deck-relay>`
- `VITE_WS_URL=wss://relay.devfellowship.com/ws`
Redeploy. O app passa a mostrar login → dashboard de pareamento.

## 5. Parear sua VPS
Na sua VPS (com `claude` CLI logado): pegue o código no dashboard e rode
`DECK_RELAY_URL=wss://relay.devfellowship.com npx tsx server/agent.ts --pair=CÓDIGO`,
depois `DECK_RELAY_URL=… npx tsx server/agent.ts` pra ficar online.

## Gate antes de VPS de TERCEIROS (DR-025)
e2e signing (T5) tem que estar enforced antes de uma VPS não-Samuel discar. Até lá o
dashboard mostra o banner "relay confiável · beta".
