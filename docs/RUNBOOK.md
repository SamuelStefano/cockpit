# Runbook do Deck

O que fazer quando alguma coisa para de funcionar. Escrito para quem não é o autor do
código conseguir agir.

## Topologia

| Peça | Onde | Como sobe |
|---|---|---|
| Front | Vercel | Deploy automático da `main` |
| Backend local | box do usuário, `127.0.0.1:7777` | `run-backend.sh` (supervisor com flock) |
| Agente | box do usuário, disca para o relay | `run-agent.sh` (supervisor com flock) |
| Relay | VPS Oracle `163.176.220.63`, `:8800` loopback, Caddy no TLS | systemd `deck-relay` |
| Monitor | VPS Oracle, `:8899` loopback | systemd `deck-monitor` |
| Banco | Supabase `deck-relay` (projeto próprio, separado do DFL) | — |

## "O Deck caiu" — ordem de diagnóstico

Siga nesta ordem. A causa mais comum está em primeiro lugar, e ela **não** é o que
parece à primeira vista.

**1. O relay está defasado da `main`?**

```bash
ssh -i ~/.ssh/oracle_relay ubuntu@163.176.220.63
cd /home/ubuntu/cockpit && git log --oneline -1 && git fetch && git status -sb
```

O deploy do relay é **manual**. Correção que entra na `main` não chega no ar sozinha.
Já aconteceu de ficar 369 commits e 2,5 meses atrás sem ninguém notar — o sintoma era
a aba presa na tela de pareamento com a VPS de pé do outro lado. **Confira isto antes
de qualquer outra coisa.**

```bash
git pull --ff-only && sudo systemctl restart deck-relay   # ~5s de piscada; tudo reconecta
```

**2. O relay responde?**

```bash
curl -s https://deck-relay.devfellowship.com/status
```

Sem resposta → problema de VPS, Caddy ou DNS. Com `ok:true` → o relay está bem, siga.

**3. Há agente conectado?**

```bash
curl -s -H "authorization: Bearer $DECK_STATUS_TOKEN" https://deck-relay.devfellowship.com/status
```

`agents: 0` com `accounts > 0` → o relay está bem e a box do usuário é que não está
discando. Vá para o passo 4.

**4. O backend/agente da box está de pé?**

```bash
curl -s 127.0.0.1:7777/healthz
pgrep -af 'server/(index|agent).ts'
```

Caído → `bash run-backend.sh` e `bash run-agent.sh` (ambos são supervisores com trava:
rodar duas vezes não duplica processo).

**5. A box está sem recurso?**

```bash
free -h; df -h /; uptime
```

Esta é a falha histórica da box do Samuel: RAM saturada leva a congelamento. Já há
`earlyoom`, swap e `scripts/doctor.sh` no cron. Disco abaixo de ~5 GB livres também
derruba — o maior ofensor costuma ser cache de build do Docker (`docker system df`).

## Monitor

```bash
ssh -i ~/.ssh/oracle_relay ubuntu@163.176.220.63
systemctl status deck-monitor
journalctl -u deck-monitor -n 50
curl -s 127.0.0.1:8899?days=30 | jq     # disponibilidade acumulada
```

Estados e configuração em [`../monitor/README.md`](../monitor/README.md).
`degraded` significa relay de pé e nenhuma máquina de usuário conectada — o problema
está na box do usuário, não no relay.

## Deploy

| Peça | Como |
|---|---|
| Front | Merge na `main` → Vercel |
| Backend/agente locais | `npm run update` na box |
| Relay | **Manual:** `git pull --ff-only` + `sudo systemctl restart deck-relay` |
| Monitor | **Manual:** `git pull --ff-only` + `sudo systemctl restart deck-monitor` |

O README em `relay/deploy/` está desatualizado (fala em usuário `relay` e
`/opt/deck-relay`); o que está no ar é o descrito aqui.

## Rotação do segredo do /status

O `DECK_STATUS_TOKEN` é compartilhado entre relay e monitor. Para trocar:

```bash
openssl rand -hex 32                          # novo valor
# edite .env.relay e .env.monitor com o MESMO valor
sudo systemctl restart deck-relay deck-monitor
```

Perder o token não derruba nada: o `/status` continua respondendo o corpo público, o
monitor só perde a visão de quantos agentes estão online.

## Onboarding de uma máquina nova

1. Usuário faz login no front e pede um código de pareamento (validade de 10 minutos,
   uso único).
2. Na máquina dele: `npx tsx server/agent.ts --pair=CÓDIGO`.
3. O par de chaves é gerado **na máquina dele**, em `~/.deck-agent/identity.json`
   (permissão 0600). A chave privada não sai dali.
4. Depois do pareamento, `run-agent.sh` mantém o agente de pé.

O papel padrão de conta convidada é o restrito (sem terminal, sem ação
administrativa). Elevar exige ação de conta root, definida por variável de ambiente no
relay — nunca pelo banco.
