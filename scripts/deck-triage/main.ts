import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ACTIONS, createActionGate, executeAction, logAction, type ActionId } from './actions.ts';
import { askClaude } from './claude.ts';
import { runChecks, type Findings } from './checks.ts';
import { loadConfig } from './config.ts';
import { buildPrompt, deterministicDiagnosis, mergeDiagnosis, parseModelAnswer, type Diagnosis } from './diagnose.ts';
import { createIncidentTracker, type Incident } from './incidents.ts';
import { formatRecheck, formatTriage, HELP_TEXT } from './message.ts';
import { advanceCursor, fetchNewReports, fileCursor } from './relay.ts';
import { actionButtons, classifyUpdate, createTelegram } from './telegram.ts';
import { run } from './exec.ts';

const POLL_MS = 60_000;
const CLAUDE_HOURLY = 6;
const MAX_TRIAGES_PER_TICK = 3;
const RELAY_DOWN_ALERT_MS = 60 * 60 * 1000;

const cfg = loadConfig();
await mkdir(cfg.stateDir, { recursive: true, mode: 0o700 });
const actionsLog = join(cfg.stateDir, 'actions.log');
const offsetFile = join(cfg.stateDir, 'tg-offset.json');
const cursorStore = fileCursor(join(cfg.stateDir, 'cursor.json'));
const tg = createTelegram(cfg.telegramToken);
const gate = createActionGate();
const tracker = createIncidentTracker();
const deps = { cfg, runner: run };
const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

let claudeTimes: number[] = [];
let busy = false;
let relayFailures = 0;
let relayAlertAt = 0;

async function diagnose(f: Findings, inc: Incident | null): Promise<Diagnosis> {
  const det = deterministicDiagnosis(f);
  const t = Date.now();
  claudeTimes = claudeTimes.filter((x) => t - x < 3_600_000);
  if (claudeTimes.length >= CLAUDE_HOURLY) return det;
  claudeTimes.push(t);
  const raw = await askClaude(cfg, buildPrompt(f, inc, det)).catch(() => null);
  const ans = raw ? parseModelAnswer(raw) : null;
  if (raw && !ans) log('claude answer rejected, using rules', { len: raw.length });
  return mergeDiagnosis(det, ans);
}

async function triage(inc: Incident | null): Promise<void> {
  const f = await runChecks(deps, inc?.accountId ?? null);
  const d = await diagnose(f, inc);
  await tg.send(cfg.chatId, formatTriage(inc, d, f), actionButtons(d.actions, inc?.id ?? 'status'));
  log('triage sent', { incident: inc?.id ?? null, kind: inc?.kind ?? null, actions: d.actions, source: d.source });
}

async function pollReports(): Promise<void> {
  let cur = await cursorStore.load();
  if (!cur) {
    cur = { at: new Date().toISOString(), ids: [] };
    await cursorStore.save(cur);
    return;
  }
  let rows;
  try {
    rows = await fetchNewReports(run, cfg.relay, cur);
    relayFailures = 0;
  } catch (e) {
    relayFailures++;
    log('report fetch failed', { err: (e as Error).message, failures: relayFailures });
    // The relay host is also the report source: if it is unreachable, say so ourselves.
    if (relayFailures >= 3 && Date.now() - relayAlertAt > RELAY_DOWN_ALERT_MS) {
      relayAlertAt = Date.now();
      await triage(null).catch((err) => log('triage failed', { err: String(err) }));
    }
    return;
  }
  if (!rows.length) return;
  const { fresh, folded } = tracker.ingest(rows);
  await cursorStore.save(advanceCursor(cur, rows));
  log('reports', { new: rows.length, incidents: fresh.length, folded });
  for (const inc of fresh.slice(0, MAX_TRIAGES_PER_TICK)) {
    await triage(inc).catch((e) => log('triage failed', { incident: inc.id, err: String(e) }));
  }
  if (fresh.length > MAX_TRIAGES_PER_TICK) log('triage cap per tick', { skipped: fresh.length - MAX_TRIAGES_PER_TICK });
}

const RECHECK_DELAY_MS: Record<ActionId, number> = {
  restart_relay: 8_000, reload_caddy: 5_000, redeploy_web: 120_000, redeploy_ops: 120_000, restart_local_agent: 15_000, ignore: 0,
};

async function handleAction(action: ActionId, ref: string, callbackId: string, messageId: number | null): Promise<void> {
  const g = gate.check(action);
  if (!g.ok) {
    await tg.answer(callbackId, `Recusado: ${g.reason}`);
    await logAction(actionsLog, { action, ref, outcome: 'refused', reason: g.reason });
    return;
  }
  if (action === 'ignore') {
    gate.record(action);
    await tg.answer(callbackId, 'Ignorado');
    if (messageId) await tg.clearButtons(cfg.chatId, messageId).catch(() => {});
    await logAction(actionsLog, { action, ref, outcome: 'ok' });
    return;
  }
  if (busy) { await tg.answer(callbackId, 'Outra ação em andamento'); return; }
  busy = true;
  try {
    gate.record(action);
    await tg.answer(callbackId, `Executando: ${ACTIONS[action].label}`).catch(() => {});
    if (messageId) await tg.clearButtons(cfg.chatId, messageId).catch(() => {});
    let result: string;
    try { result = await executeAction(action, deps); } catch (e) { result = `falhou: ${(e as Error).message}`; }
    await logAction(actionsLog, { action, ref, outcome: result });
    await new Promise((r) => setTimeout(r, RECHECK_DELAY_MS[action]));
    const f = await runChecks(deps, null);
    await tg.send(cfg.chatId, formatRecheck(action, result, f));
  } finally {
    busy = false;
  }
}

async function loadOffset(): Promise<number> {
  try { return Number(JSON.parse(await readFile(offsetFile, 'utf8')).offset) || 0; } catch { return 0; }
}
async function saveOffset(offset: number): Promise<void> {
  await writeFile(`${offsetFile}.tmp`, JSON.stringify({ offset }));
  await rename(`${offsetFile}.tmp`, offsetFile);
}

async function telegramLoop(): Promise<never> {
  let offset = await loadOffset();
  for (;;) {
    let updates;
    try { updates = await tg.updates(offset); } catch (e) {
      log('getUpdates failed', { err: (e as Error).message });
      await new Promise((r) => setTimeout(r, 10_000));
      continue;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      // Offset first: a crash in the handler must not replay a restart forever.
      await saveOffset(offset);
      const inb = classifyUpdate(u, cfg.chatId);
      if (inb.type === 'ignored') { log('update ignored', { reason: inb.reason }); continue; }
      if (inb.type === 'command') {
        if (inb.command === 'status') await triage(null).catch((e) => log('status failed', { err: String(e) }));
        else await tg.send(cfg.chatId, HELP_TEXT).catch(() => {});
        continue;
      }
      // Not awaited: the poll keeps answering while a redeploy waits for its recheck.
      void handleAction(inb.action, inb.ref, inb.callbackId, inb.messageId).catch((e) => log('action failed', { err: String(e) }));
    }
  }
}

async function reportLoop(): Promise<never> {
  for (;;) {
    await pollReports().catch((e) => log('poll failed', { err: String(e) }));
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

log('deck-triage up', { chat: cfg.chatId, relay: cfg.relay.host, dokploy: Boolean(cfg.dokploy), claude: cfg.anthropicKey ? 'api-key' : 'oauth' });
await Promise.all([reportLoop(), telegramLoop()]);
