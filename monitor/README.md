# Monitor externo do Deck

Vigia que sonda o `/status` do relay em intervalo fixo, guarda a série em disco e
avisa quando o estado muda. Sem dependência fora da biblioteca padrão do Node.

## Por que ele existe

O `doctor.sh` e o `run-agent.sh` vigiam o Deck **de dentro da box observada**. No modo
de falha real — a box travar, como em 07-11 e 08-10 — o vigia trava junto e ninguém
fica sabendo. Além disso, as métricas do Deck viviam só em memória e sumiam a cada
restart, então não havia como comprovar a meta de disponibilidade: a afirmação seria
autoavaliação sem série histórica.

## Onde roda e por quê

**Na VPS Oracle (`163.176.220.63`), a mesma do relay.** A escolha não é ideal e vale
explicar:

- O que quebra na prática é a **box do agente** (`samuel-agents`, Hetzner): RAM
  saturada, congelamento, agente defasado da `main`. Em relação a ela o monitor é
  genuinamente externo, e é ela que a sonda enxerga através do campo `agents`.
- A sonda vai pela **URL pública**, não por loopback — então exercita DNS, TLS, Caddy
  e relay, e não apenas o processo ao lado.
- Custo zero (free tier), e a Hetzner não tem RAM sobrando: 122 MB livres com 2,2 GB
  de swap em uso.

**Ponto cego assumido:** se a VPS Oracle inteira cair, o monitor cai com o relay e não
há quem avise. A cobertura disso é um verificador externo gratuito (UptimeRobot,
BetterStack ou equivalente) apontado para `https://deck-relay.devfellowship.com/status`,
esperando HTTP 200 — sem token, o corpo público já basta para esse fim. Cinco minutos
de configuração, sem custo. **Enquanto isso não for feito, o ponto cego é real.**

Se o produto passar a ter cliente pagante, a decisão correta muda para uma terceira
VPS dedicada, isolada das duas.

## Instalação na VPS Oracle

```bash
ssh -i ~/.ssh/oracle_relay ubuntu@163.176.220.63
cd /home/ubuntu/cockpit && git pull --ff-only

# Segredo compartilhado com o relay (gerar uma vez):
openssl rand -hex 32
```

O mesmo valor vai nos dois lados:

```bash
# /home/ubuntu/cockpit/.env.relay      → o relay passa a servir o /status detalhado
DECK_STATUS_TOKEN=<valor>

# /home/ubuntu/cockpit/.env.monitor    → o monitor passa a enxergar as contagens
DECK_STATUS_TOKEN=<mesmo valor>
DECK_MONITOR_URL=https://deck-relay.devfellowship.com/status
DECK_MONITOR_WEBHOOK=<opcional: URL de webhook para o alerta>
```

```bash
sudo cp monitor/deck-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deck-monitor
sudo systemctl restart deck-relay      # para o relay ler o DECK_STATUS_TOKEN

journalctl -u deck-monitor -f
curl -s 127.0.0.1:8899 | jq            # resumo dos últimos 30 dias
```

## Configuração

| Variável | Padrão | Para que serve |
|---|---|---|
| `DECK_MONITOR_URL` | `https://deck-relay.devfellowship.com/status` | Alvo da sonda |
| `DECK_STATUS_TOKEN` | — | Sem ele, só dá para saber se o relay responde; com ele, quantos agentes estão online |
| `DECK_MONITOR_WEBHOOK` | — | Destino do alerta. Sem webhook, o alerta sai no log |
| `DECK_MONITOR_FILE` | `~/.deck-monitor/history.jsonl` | Série histórica |
| `DECK_MONITOR_INTERVAL_MS` | `60000` | Intervalo entre sondas |
| `DECK_MONITOR_CONFIRM` | `3` | Leituras iguais seguidas antes de alertar |
| `DECK_MONITOR_RETENTION_DAYS` | `90` | Janela mantida em disco |
| `DECK_MONITOR_PORT` | `8899` | Resumo HTTP, **sempre em loopback** |

## Estados

| Estado | Significado | Dono do problema |
|---|---|---|
| `up` | Relay responde e há agente conectado | — |
| `degraded` | Relay responde, mas nenhuma máquina de usuário conectada | Box do usuário |
| `down` | Relay não responde, responde fora de 2xx, ou sem `ok:true` | VPS do relay / Caddy / DNS |

Separar `degraded` de `down` importa: são causas e donos diferentes. Alertar só depois
de três leituras iguais evita que um soluço de rede vire alerta — alerta que erra
treina o dono a ignorar, o que é pior que não ter alerta.

## Segurança

- O corpo público do `/status` é deliberadamente pobre (`ok`, `uptimeSec`). Contagem de
  contas e de agentes é dado de negócio e fica atrás do `DECK_STATUS_TOKEN`.
- Sem token configurado no relay, o detalhe **não existe** — negação por padrão.
- A comparação do token é em tempo constante (`timingSafeEqual`): `===` em string
  vazaria o tamanho do prefixo correto pelo tempo de resposta, e o endpoint é público.
- O resumo HTTP do monitor escuta **apenas** em `127.0.0.1`.
