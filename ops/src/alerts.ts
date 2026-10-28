import { readFile, rename, writeFile } from 'node:fs/promises';
import type { DiagReport, OpsData } from './data.ts';
import { summarize } from './summary.ts';
import { brt } from './time.ts';

export const GROUP_WINDOW_MS = 15 * 60 * 1000;
export const HOURLY_MAX = 20;
const HOUR_MS = 60 * 60 * 1000;
const BATCH = 200;
const TELEGRAM_MAX = 4000;

// Reports at exactly `at` were already handled; ids keeps them out of the next gte read.
export interface Cursor { at: string; ids: string[] }

export interface CursorStore {
  load(): Promise<Cursor | null>;
  save(c: Cursor): Promise<void>;
}

export function fileCursorStore(path: string): CursorStore {
  return {
    async load() {
      try {
        const c = JSON.parse(await readFile(path, 'utf8')) as Cursor;
        return typeof c?.at === 'string' && Array.isArray(c.ids) ? c : null;
      } catch { return null; }
    },
    async save(c) {
      const tmp = `${path}.tmp`;
      await writeFile(tmp, JSON.stringify(c));
      await rename(tmp, path);
    },
  };
}

export type SendFn = (text: string) => Promise<void>;

export function telegramSender(token: string, chatId: string, fetchImpl: typeof fetch = fetch): SendFn {
  return async (text) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // No parse_mode: report fields are user-controlled and go out as plain text.
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, TELEGRAM_MAX), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`telegram: HTTP ${res.status}`);
  };
}

export interface AlertCtx { email: string; boxLabel: string; publicUrl: string; folded: number }

export function formatAlert(r: DiagReport, ctx: AlertCtx): string {
  const lines = [
    `Deck: relatório ${r.source}/${r.kind}`,
    `Quem: ${ctx.email || r.account_id}`,
    `Box: ${ctx.boxLabel || r.box_id || '—'}`,
    `Quando: ${brt(r.created_at)}`,
    `Resumo: ${summarize(r)}`,
  ];
  if (ctx.folded > 0) lines.push(`(+${ctx.folded} parecido(s) agrupado(s) desde o último aviso)`);
  lines.push(`${ctx.publicUrl}/reports/${r.id}`);
  return lines.join('\n');
}

export interface AlerterDeps {
  data: Pick<OpsData, 'reportsSince' | 'listAgents' | 'emails'>;
  cursor: CursorStore;
  send: SendFn;
  now: () => number;
  publicUrl: string;
  log?: (msg: string) => void;
}

export interface Alerter { tick(): Promise<{ sent: number; folded: number }> }

export function createAlerter(deps: AlerterDeps): Alerter {
  const log = deps.log ?? ((m: string) => console.log(m));
  const lastSent = new Map<string, number>();
  const pending = new Map<string, number>();
  let sendTimes: number[] = [];
  let capDropped = 0;
  let cursor: Cursor | null = null;

  return {
    async tick() {
      if (!cursor) {
        cursor = await deps.cursor.load();
        if (!cursor) {
          cursor = { at: new Date(deps.now()).toISOString(), ids: [] };
          await deps.cursor.save(cursor);
          return { sent: 0, folded: 0 };
        }
      }
      const seen = new Set(cursor.ids);
      const rows = (await deps.data.reportsSince(cursor.at, BATCH)).filter((r) => !seen.has(r.id));
      if (!rows.length) return { sent: 0, folded: 0 };
      const [emails, agents] = await Promise.all([
        deps.data.emails().catch(() => new Map<string, string>()),
        deps.data.listAgents().catch(() => []),
      ]);
      const labels = new Map(agents.map((a) => [a.id, a.label]));
      let sent = 0;
      let folded = 0;
      for (const r of rows) {
        const t = deps.now();
        const key = `${r.account_id}|${r.kind}`;
        sendTimes = sendTimes.filter((x) => t - x < HOUR_MS);
        const grouped = t - (lastSent.get(key) ?? -Infinity) < GROUP_WINDOW_MS;
        if (grouped || sendTimes.length >= HOURLY_MAX) {
          pending.set(key, (pending.get(key) ?? 0) + 1);
          if (!grouped) capDropped++;
          folded++;
        } else {
          const text = formatAlert(r, { email: emails.get(r.account_id) ?? '', boxLabel: r.box_id ? labels.get(r.box_id) ?? '' : '', publicUrl: deps.publicUrl, folded: pending.get(key) ?? 0 });
          lastSent.set(key, t);
          sendTimes.push(t);
          pending.delete(key);
          try { await deps.send(text); sent++; } catch (e) { log(`alert send failed: ${(e as Error).message}`); }
        }
        // Advance even when sending failed: a broken bot must not replay the backlog forever.
        cursor = r.created_at === cursor.at ? { at: cursor.at, ids: [...cursor.ids, r.id] } : { at: r.created_at, ids: [r.id] };
      }
      await deps.cursor.save(cursor);
      if (capDropped) { log(`alerts: hourly cap reached, ${capDropped} report(s) folded so far`); capDropped = 0; }
      return { sent, folded };
    },
  };
}
