import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAlerter, type Cursor, type CursorStore, fileCursorStore, formatAlert, GROUP_WINDOW_MS, HOURLY_MAX, telegramSender } from './alerts.ts';
import type { DiagReport } from './data.ts';

const ACC = 'aaaaaaaa-0000-0000-0000-000000000001';
const BOX = 'bbbbbbbb-0000-0000-0000-000000000001';
let seq = 0;
const report = (over: Partial<DiagReport> = {}): DiagReport => ({
  id: `00000000-0000-0000-0000-${String(++seq).padStart(12, '0')}`,
  created_at: new Date(1_800_000_000_000 + seq * 1000).toISOString(),
  account_id: ACC, source: 'browser', kind: 'box-offline', box_id: BOX,
  app_version: null, user_agent: null, payload: { cause: 'box-offline', lastClose: { code: 4404 } },
  ...over,
});

function memCursor(initial: Cursor | null = { at: '1970-01-01T00:00:00.000Z', ids: [] }): CursorStore & { value: Cursor | null } {
  const s = { value: initial, async load() { return s.value; }, async save(c: Cursor) { s.value = c; } };
  return s;
}

function setup(rows: DiagReport[], cursor = memCursor()) {
  let t = 1_800_000_000_000;
  const sent: string[] = [];
  const db = { rows };
  const alerter = createAlerter({
    data: {
      reportsSince: async (at) => db.rows.filter((r) => r.created_at >= at),
      emails: async () => new Map([[ACC, 'dev@example.com']]),
      listAgents: async () => [{ id: BOX, account_id: ACC, kind: 'vps', label: 'box-um', paired_at: '', last_seen: null, revoked_at: null }],
    },
    cursor,
    send: async (text) => { sent.push(text); },
    now: () => t,
    publicUrl: 'https://ops.example',
    log: () => {},
  });
  return { alerter, sent, cursor, db, advance: (ms: number) => { t += ms; } };
}

describe('alerter', () => {
  it('starts from now on first boot and sends nothing old', async () => {
    const { alerter, sent, cursor } = setup([report()], memCursor(null));
    expect(await alerter.tick()).toEqual({ sent: 0, folded: 0 });
    expect(sent).toEqual([]);
    expect(cursor.value?.at).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it('sends each new report once and resumes from the saved cursor', async () => {
    const a = report({ kind: 'js-error' });
    const { alerter, sent, cursor, db } = setup([a]);
    await alerter.tick();
    await alerter.tick();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('dev@example.com');
    expect(sent[0]).toContain('box-um');
    expect(sent[0]).toContain(`https://ops.example/reports/${a.id}`);

    const b = report({ kind: 'crash', created_at: a.created_at });
    db.rows.push(b);
    const restarted = setup(db.rows, cursor);
    await restarted.alerter.tick();
    expect(restarted.sent).toHaveLength(1);
    expect(restarted.sent[0]).toContain('crash');
  });

  it('groups the same account and kind within 15 minutes and folds the count in', async () => {
    const rows = [report(), report(), report()];
    const { alerter, sent, db, advance } = setup(rows);
    expect(await alerter.tick()).toEqual({ sent: 1, folded: 2 });
    advance(GROUP_WINDOW_MS);
    db.rows.push(report());
    await alerter.tick();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toContain('+2');
  });

  it('caps at 20 messages per hour', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => report({ kind: `k${i}` }));
    const { alerter, sent, advance, db } = setup(rows);
    expect(await alerter.tick()).toEqual({ sent: HOURLY_MAX, folded: 5 });
    advance(60 * 60 * 1000);
    db.rows.push(report({ kind: 'later' }));
    await alerter.tick();
    expect(sent).toHaveLength(HOURLY_MAX + 1);
  });

  it('advances past a report even when Telegram fails', async () => {
    const cursor = memCursor();
    const a = report();
    const alerter = createAlerter({
      data: { reportsSince: async () => [a], emails: async () => new Map(), listAgents: async () => [] },
      cursor, send: async () => { throw new Error('down'); }, now: () => 0, publicUrl: 'https://o', log: () => {},
    });
    await alerter.tick();
    expect(cursor.value).toEqual({ at: a.created_at, ids: [a.id] });
  });
});

describe('formatAlert', () => {
  it('summarizes agent lines with the last error', () => {
    const r = report({ source: 'agent', kind: 'crash', payload: { lines: ['boot', 'Error: ENOMEM', 'exit 1'] } });
    expect(formatAlert(r, { email: 'x@y', boxLabel: '', publicUrl: 'https://o', folded: 0 })).toContain('Resumo: Error: ENOMEM');
  });
});

describe('telegramSender', () => {
  it('posts plain text with no parse_mode', async () => {
    const f = vi.fn(async () => new Response('{}'));
    await telegramSender('T', '42', f as never)('<b>*hi*</b>');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botT/sendMessage');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ chat_id: '42', text: '<b>*hi*</b>', disable_web_page_preview: true });
  });
});

describe('fileCursorStore', () => {
  let dir = '';
  afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });
  it('persists and reloads the cursor', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ops-cursor-'));
    const s = fileCursorStore(join(dir, 'c.json'));
    expect(await s.load()).toBeNull();
    await s.save({ at: 'x', ids: ['a'] });
    expect(await fileCursorStore(join(dir, 'c.json')).load()).toEqual({ at: 'x', ids: ['a'] });
  });
});
