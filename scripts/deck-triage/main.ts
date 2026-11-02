import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ACTIONS, createActionGate, executeAction, logAction, type ActionId } from './actions.ts';
import { askClaude } from './claude.ts';
import { failingSynthetic, runChecks, type Check, type Findings } from './checks.ts';
import { loadConfig } from './config.ts';
import { buildPrompt, deterministicDiagnosis, mergeDiagnosis, parseModelAnswer, type Diagnosis } from './diagnose.ts';
import { confirmFailing, decide, initialOutage, stepOutage, userSideMessage } from './gate.ts';
import { createBudget } from './budget.ts';
import { createMetrics, formatMetrics } from './metrics.ts';
import { decideResponder, investigatorAllowed, INVESTIGATE_COOLDOWN_MS, launchInvestigator, trackLoginFailing } from './responder.ts';
import { createIncidentTracker, type Incident } from './incidents.ts';
import { formatAutoHeal, formatInvestigator, formatRecheck, formatRecovery, formatTriage, HELP_TEXT, incidentHead } from './message.ts';
import { advanceCursor, fetchEmails, fetchNewReports, fileCursor } from './relay.ts';
import { actionButtons, classifyUpdate, createTelegram } from './telegram.ts';
import { run } from './exec.ts';

const POLL_MS = 60_000;
const SYNTHETIC_MS = 2 * 60_000;
const SYNTHETIC_FRESH_MS = 50_000;
const CONFIRM_DELAY_MS = 15_000;
const CLAUDE_HOURLY = 6;
const MAX_TRIAGES_PER_TICK = 3;
const AUTO_HEAL_RECHECK_MS = 20_000;

const cfg = loadConfig();
await mkdir(cfg.stateDir, { recursive: true, mode: 0o700 });
const actionsLog = join(cfg.stateDir, 'actions.log');
const offsetFile = join(cfg.stateDir, 'tg-offset.json');
const cursorStore = fileCursor(join(cfg.stateDir, 'cursor.json'));
const tg = createTelegram(cfg.telegramToken);
const gate = createActionGate();
const tracker = createIncidentTracker();
const budget = createBudget();
const metrics = createMetrics(cfg.stateDir);
await metrics.prune();
const deps = { cfg, runner: run };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

let claudeTimes: number[] = [];
let busy = false;
let outage = initialOutage();
let outageFailing: string[] = [];
let synth: { at: number; failing: Check[] } | null = null;
let loginFailingSince: number | null = null;
let lastHealAt: number | null = null;
let lastInvestigateAt: number | null = null;
let synthInFlight: Promise<Check[]> | null = null;
const kindTriagedAt = new Map<string, number>();
const KIND_DEDUP_MS = 15 * 60_000;
const emailCache = new Map<string, { email: string | null; at: number }>();
const EMAIL_TTL_MS = 60 * 60_000;

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

type Buttons = ReturnType<typeof actionButtons>;

// Every outgoing message goes through here so the metrics see it. `budgeted` messages
// (non-outage chatter) are dropped past the shared hourly/daily cap; the rest are exempt.
async function say(text: string, buttons?: Buttons, budgeted = false): Promise<boolean> {
  if (budgeted && !budget.take()) {
    log('message held back by budget', { suppressed: budget.suppressed() });
    void metrics.recordEvent('msg_suppressed');
    return false;
  }
  await tg.send(cfg.chatId, text, buttons);
  void metrics.recordEvent('msg_sent');
  return true;
}

async function triage(head: string, inc: Incident | null, opts: { budgeted?: boolean; logs?: boolean } = {}): Promise<void> {
  if (opts.budgeted && !budget.take()) {
    log('triage held back by budget', { incident: inc?.id ?? null, suppressed: budget.suppressed() });
    void metrics.recordEvent('msg_suppressed');
    return;
  }
  const f = await runChecks(deps, inc?.accountId ?? null);
  const d = await diagnose(f, inc);
  await say(formatTriage(head, d, f, { logs: opts.logs }), actionButtons(d.actions, inc?.id ?? 'status'));
  log('triage sent', { incident: inc?.id ?? null, kind: inc?.kind ?? null, actions: d.actions, source: d.source });
}

// Both loops share one synthetic run: never two probes of the relay at once.
async function syntheticFailing(): Promise<Check[]> {
  if (synth && Date.now() - synth.at < SYNTHETIC_FRESH_MS) return synth.failing;
  let lastChecks: Check[] = [];
  synthInFlight ??= confirmFailing(async () => { const f = await runChecks(deps, null, 'synthetic'); lastChecks = f.checks; return failingSynthetic(f); }, () => sleep(CONFIRM_DELAY_MS))
    .then((failing) => { synth = { at: Date.now(), failing }; void metrics.recordSynthetic(lastChecks, failing.map((c) => c.id)); return failing; })
    .finally(() => { synthInFlight = null; });
  return synthInFlight;
}

// Returns true when this call announced a new outage.
async function applyOutage(failing: Check[], inc: Incident | null, trusted?: string): Promise<boolean> {
  const step = stepOutage(outage, failing, Date.now());
  outage = step.state;
  if (step.event.type === 'opened') log('outage opened, announcing only if it lasts', { failing: step.event.failing });
  if (step.event.type === 'down') {
    log('outage down', { failing: step.event.failing });
    const by = trusted ? `\nReportado por ${trusted} (confiável)` : '';
    await triage(`Queda confirmada (checagem sintética daqui): ${step.event.failing.join(', ')}${by}`, inc);
    return true;
  }
  if (step.event.type === 'recovered') {
    if (step.event.announced) {
      log('outage recovered', { downMs: step.event.downMs });
      await say(formatRecovery(step.event.downMs, outageFailing));
    } else {
      log('outage blip recovered before announcement', { downMs: step.event.downMs });
    }
  }
  if (failing.length) outageFailing = failing.map((c) => c.id);
  return false;
}

async function resolveEmails(incs: Incident[]): Promise<void> {
  const t = Date.now();
  const missing = [...new Set(incs.map((i) => i.accountId))].filter((id) => !emailCache.has(id) || t - emailCache.get(id)!.at > EMAIL_TTL_MS);
  if (missing.length) {
    const found = await fetchEmails(run, cfg.relay, missing).catch((e) => { log('email lookup failed', { err: String(e) }); return null; });
    if (found) for (const id of missing) emailCache.set(id, { email: found.get(id) ?? null, at: t });
  }
  for (const i of incs) i.email = emailCache.get(i.accountId)?.email ?? null;
}

async function evaluatePending(): Promise<void> {
  const pending = tracker.pending();
  if (!pending.length) return;
  await resolveEmails(pending);
  const failing = await syntheticFailing();
  let sent = 0;
  for (const inc of pending) {
    const v = decide(inc, failing, tracker.all(), Date.now(), cfg.trustedEmails);
    if (v.verdict === 'suppress') { log('incident suppressed', { incident: inc.id, kind: inc.kind, reason: v.reason }); continue; }
    tracker.escalate(inc);
    if (sent >= MAX_TRIAGES_PER_TICK) { log('triage cap per tick', { incident: inc.id }); continue; }
    sent++;
    try {
      if (v.verdict === 'user-side') {
        if (await say(userSideMessage(inc, v.reason), undefined, true)) log('user-side sent', { incident: inc.id, kind: inc.kind });
      } else if (failing.length) {
        // Synthetic failure: one message per outage, not one per affected account.
        if (!(await applyOutage(failing, inc, v.trusted))) log('incident covered by open outage', { incident: inc.id });
      } else if (v.trusted) {
        await triage(`${incidentHead(inc)}\nReportado por ${v.trusted} (confiável)`, inc, { budgeted: true });
      } else if (Date.now() - (kindTriagedAt.get(inc.kind) ?? 0) < KIND_DEDUP_MS) {
        log('incident covered by recent triage of same kind', { incident: inc.id, kind: inc.kind });
      } else {
        kindTriagedAt.set(inc.kind, Date.now());
        await triage(`${incidentHead(inc)}\nConfirmado: ${v.reason}`, inc, { budgeted: true });
      }
    } catch (e) {
      log('triage failed', { incident: inc.id, err: String(e) });
    }
  }
}

async function pollReports(): Promise<void> {
  let cur = await cursorStore.load();
  if (!cur) {
    cur = { at: new Date().toISOString(), ids: [] };
    await cursorStore.save(cur);
    return;
  }
  try {
    const rows = await fetchNewReports(run, cfg.relay, cur);
    if (rows.length) {
      const { opened, folded } = tracker.ingest(rows);
      await cursorStore.save(advanceCursor(cur, rows));
      log('reports', { new: rows.length, opened: opened.length, folded });
    }
  } catch (e) {
    // The relay host is also the report source; the synthetic loop catches it being down.
    log('report fetch failed', { err: (e as Error).message });
  }
  await evaluatePending();
  for (const closed of tracker.prune(Date.now())) if (closed.state === 'pending') log('incident closed without escalation', { incident: closed.id, kind: closed.kind });
}

async function autoHeal(): Promise<void> {
  if (busy) return;
  const g = gate.check('restart_relay');
  if (!g.ok) { log('auto-heal refused by gate', { reason: g.reason }); return; }
  busy = true;
  try {
    gate.record('restart_relay');
    const downMs = loginFailingSince === null ? 0 : Date.now() - loginFailingSince;
    lastHealAt = Date.now();
    let result: string;
    try { result = await executeAction('restart_relay', deps); } catch (e) { result = `falhou: ${(e as Error).message}`; }
    await logAction(actionsLog, { action: 'restart_relay', ref: 'auto', outcome: result });
    void metrics.recordEvent('auto_heal');
    log('auto-heal ran', { result });
    await sleep(AUTO_HEAL_RECHECK_MS);
    const f = await runChecks(deps, null, 'synthetic');
    await say(formatAutoHeal(downMs, 'restart_relay', result, f));
  } finally {
    busy = false;
  }
}

// Returns a user-facing refusal, or null when the session was launched (or tried).
async function investigate(trigger: 'auto' | 'manual'): Promise<string | null> {
  const now = Date.now();
  if (!investigatorAllowed(now, lastInvestigateAt)) {
    return `Já abri uma investigação há pouco; próxima liberada em ${Math.ceil((INVESTIGATE_COOLDOWN_MS - (now - (lastInvestigateAt ?? 0))) / 60_000)} min.`;
  }
  if (busy) return 'Outra ação em andamento.';
  busy = true;
  // Stamped before the call: a broken deckctl must not be retried every tick.
  lastInvestigateAt = now;
  try {
    const r = await launchInvestigator({ runner: run, bin: cfg.deckctlBin, home: cfg.home }, synth?.failing.map((c) => c.id) ?? []);
    log('investigator', { trigger, ok: r.ok, ...(r.ok ? { sessionId: r.sessionId } : { reason: r.reason }) });
    void metrics.recordEvent('investigator');
    await say(formatInvestigator(r)).catch((e) => log('investigator message failed', { err: String(e) }));
  } finally {
    busy = false;
  }
  return null;
}

async function responderTick(failing: Check[]): Promise<void> {
  const ids = failing.map((c) => c.id);
  loginFailingSince = trackLoginFailing(loginFailingSince, ids, Date.now());
  const d = decideResponder({ now: Date.now(), failingIds: ids, loginFailingSince, outage, lastHealAt, lastInvestigateAt });
  if (d === 'heal') await autoHeal();
  else if (d === 'investigate') await investigate('auto');
}

async function syntheticLoop(): Promise<never> {
  for (;;) {
    try {
      const failing = await syntheticFailing();
      await applyOutage(failing, null);
      await responderTick(failing);
    } catch (e) { log('synthetic failed', { err: String(e) }); }
    await metrics.heartbeat();
    await sleep(SYNTHETIC_MS);
  }
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
    await say(formatRecheck(action, result, f));
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
        if (inb.command === 'status') await triage('Status sob demanda', null, { logs: true }).catch((e) => log('status failed', { err: String(e) }));
        else if (inb.command === 'metricas') await say(formatMetrics(await metrics.load(), Date.now())).catch((e) => log('metricas failed', { err: String(e) }));
        else if (inb.command === 'investigar') {
          // Not awaited: the poll keeps answering while deckctl runs.
          void investigate('manual').then((refusal) => (refusal ? say(refusal) : undefined)).catch((e) => log('investigar failed', { err: String(e) }));
        } else await say(HELP_TEXT).catch(() => {});
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
    await sleep(POLL_MS);
  }
}

log('deck-triage up', { chat: cfg.chatId, relay: cfg.relay.host, dokploy: Boolean(cfg.dokploy), claude: cfg.anthropicKey ? 'api-key' : 'oauth' });
await Promise.all([reportLoop(), syntheticLoop(), telegramLoop()]);
