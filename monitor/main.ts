import { createServer } from 'node:http';
import { classify, nextAlert, initialAlertState, type ProbeResult, type Sample, type StatusBody } from './probe';
import { appendSample, readSamples, availability, prune } from './history';

// Vigia externo do Deck. Roda numa máquina que NÃO é a observada, sonda o /status
// do relay em intervalo fixo, guarda a série em disco e avisa na transição de
// estado. Sem dependência fora da biblioteca padrão do Node — instalar isto numa
// VPS free tier tem que ser copiar arquivo e subir o serviço.

const url = process.env.DECK_MONITOR_URL ?? 'https://deck-relay.devfellowship.com/status';
const token = process.env.DECK_STATUS_TOKEN ?? '';
const webhook = process.env.DECK_MONITOR_WEBHOOK ?? '';
const file = process.env.DECK_MONITOR_FILE ?? `${process.env.HOME}/.deck-monitor/history.jsonl`;
const intervalMs = Number(process.env.DECK_MONITOR_INTERVAL_MS ?? 60_000);
const timeoutMs = Number(process.env.DECK_MONITOR_TIMEOUT_MS ?? 10_000);
const confirmAfter = Number(process.env.DECK_MONITOR_CONFIRM ?? 3);
const retentionDays = Number(process.env.DECK_MONITOR_RETENTION_DAYS ?? 90);
const port = Number(process.env.DECK_MONITOR_PORT ?? 8899);

async function probe(): Promise<ProbeResult> {
  const started = Date.now();
  // AbortSignal.timeout: sem teto explícito uma conexão pendurada trava o loop
  // inteiro e o monitor fica mudo justamente durante a falha que devia reportar.
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    const latencyMs = Date.now() - started;
    let body: StatusBody | null = null;
    try { body = (await r.json()) as StatusBody; } catch { /* corpo não-JSON: classify trata */ }
    return { status: r.status, body, latencyMs };
  } catch (e) {
    return { status: null, body: null, latencyMs: null, error: e instanceof Error ? e.message : 'erro' };
  }
}

// Um webhook fora do ar não pode derrubar o vigia — ele é o último a poder cair.
async function notify(text: string): Promise<void> {
  if (!webhook) { console.log(`[monitor] (sem webhook) ${text}`); return; }
  try {
    await fetch(webhook, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: text, text }),
    });
  } catch (e) {
    console.error('[monitor] webhook falhou:', e instanceof Error ? e.message : e);
  }
}

let alertState = initialAlertState();

async function tick(): Promise<void> {
  const sample: Sample = { ts: Date.now(), ...classify(await probe()) };
  appendSample(file, sample);

  const { state, alert } = nextAlert(alertState, sample, confirmAfter);
  alertState = state;
  if (alert) {
    const day = availability(readSamples(file, Date.now() - 86_400_000));
    const emoji = alert.to === 'up' ? '✅' : alert.to === 'degraded' ? '⚠️' : '🔴';
    await notify(
      `${emoji} Deck: ${alert.from} → ${alert.to} (${alert.detail})\n`
      + `24h: relay ${day.relayPct}% · cadeia completa ${day.fullPct}% · ${day.total} sondas`,
    );
  }
}

// O tick roda em loop encadeado, não em setInterval: com setInterval uma sonda
// lenta se sobrepõe à seguinte e o histórico ganha amostras fora de ordem.
async function loop(): Promise<void> {
  for (;;) {
    try { await tick(); } catch (e) { console.error('[monitor] tick:', e); }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// Leitura do histórico em loopback: `curl 127.0.0.1:8899` por SSH mostra a
// disponibilidade acumulada sem precisar ler o JSONL na mão. Nunca em 0.0.0.0.
createServer((req, res) => {
  const days = Number(new URL(req.url ?? '/', 'http://x').searchParams.get('days') ?? 30);
  const win = readSamples(file, Date.now() - days * 86_400_000);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ days, ...availability(win), state: alertState }, null, 2));
}).listen(port, '127.0.0.1', () => console.log(`[monitor] resumo em 127.0.0.1:${port}`));

setInterval(() => {
  const kept = prune(file, Date.now() - retentionDays * 86_400_000);
  console.log(`[monitor] poda: ${kept} amostras mantidas`);
}, 86_400_000).unref();

console.log(`[monitor] sondando ${url} a cada ${intervalMs / 1000}s (confirma em ${confirmAfter})`);
if (!token) console.warn('[monitor] sem DECK_STATUS_TOKEN: só dá pra ver se o relay responde, não quantos agentes estão online');
void loop();
