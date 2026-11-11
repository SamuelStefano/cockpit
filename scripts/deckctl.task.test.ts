import { describe, it, expect } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlannerTask } from '../shared/planner';
import {
  findByRef, findDuplicate, formatTaskList, mergeLinks, normalizeTitle, parseColumn, parseDifficulty, parseLinkSpec, parseTaskArgs,
  sameTaskContent, parseFlags, parseRef, parseTag,
} from './deckctl.mts';
import { topOrder } from '../src/planner/planner-logic';

const NOW = Date.UTC(2026, 10, 11, 12);
const DAY = 86_400_000;
const task = (o: Partial<PlannerTask>): PlannerTask => ({
  id: 'abcdef123456', title: 'T', description: '', links: [], difficulty: 1, column: 'backlog', order: 0, createdAt: 1, updatedAt: 1, ...o,
});

describe('parseTaskArgs', () => {
  it('collects repeated --link in order', () => {
    const r = parseTaskArgs(['add', 'Title', '--link', 'https://a.dev', '--link', 'https://b.dev|B', '--col', 'today']);
    expect(r.links).toEqual(['https://a.dev', 'https://b.dev|B']);
    expect(r.flags.col).toBe('today');
    expect(r.positional).toEqual(['add', 'Title']);
  });

  it('does not let boolean flags swallow the title', () => {
    const r = parseTaskArgs(['--force', 'My title', '--json']);
    expect(r.positional).toEqual(['My title']);
    expect(r.flags.force).toBe(true);
  });

  it('rejects unknown flags and missing values', () => {
    expect(() => parseTaskArgs(['--description', 'x'])).toThrow(/unknown flag/);
    expect(() => parseTaskArgs(['--desc'])).toThrow(/needs a value/);
    expect(() => parseTaskArgs(['--col', '--force'])).toThrow(/needs a value/);
  });

  it('leaves the shared parseFlags behaviour untouched', () => {
    expect(parseFlags(['--link', 'a', '--link', 'b']).flags.link).toBe('b');
  });
});

describe('validation', () => {
  it('normalizes titles', () => {
    expect(normalizeTitle('  Fix   The\tBug ')).toBe('fix the bug');
  });

  it('validates column and difficulty', () => {
    expect(parseColumn('done')).toBe('done');
    expect(() => parseColumn('now')).toThrow(/invalid column/);
    expect(parseDifficulty('3')).toBe(3);
    expect(() => parseDifficulty('4')).toThrow(/invalid difficulty/);
    expect(() => parseDifficulty('1.5')).toThrow();
  });

  it('parses links with optional labels and only http(s)', () => {
    expect(parseLinkSpec('https://github.com/a/b/pull/1|PR #1')).toEqual({ url: 'https://github.com/a/b/pull/1', label: 'PR #1' });
    expect(parseLinkSpec('http://x.dev')).toEqual({ url: 'http://x.dev/' });
    expect(() => parseLinkSpec('javascript:alert(1)')).toThrow(/http/);
    expect(() => parseLinkSpec('not a url')).toThrow(/invalid link/);
  });

  it('appends links deduped by url and enforces the cap', () => {
    const merged = mergeLinks([{ url: 'https://a.dev/' }], ['https://a.dev', 'https://b.dev|B']);
    expect(merged).toEqual([{ url: 'https://a.dev/' }, { url: 'https://b.dev/', label: 'B' }]);
    const many = Array.from({ length: 11 }, (_, i) => `https://x.dev/${i}`);
    expect(() => mergeLinks([], many)).toThrow(/too many/);
  });
});

describe('findDuplicate', () => {
  const tasks = [task({ id: 'a', title: 'Fix login' }), task({ id: 'b', title: 'Ship it', column: 'done', doneAt: NOW })];
  it('matches a non-done task by normalized title', () => {
    expect(findDuplicate(tasks, '  FIX   login ')?.id).toBe('a');
  });
  it('ignores done tasks', () => {
    expect(findDuplicate(tasks, 'ship it')).toBeUndefined();
  });
});

describe('ref and tag', () => {
  it('finds a task by ref, done or not', () => {
    const tasks = [task({ id: 'a', ref: 'DFL-01498', column: 'done', doneAt: NOW })];
    expect(findByRef(tasks, 'DFL-01498')?.id).toBe('a');
    expect(findByRef(tasks, 'DFL-1')).toBeUndefined();
    expect(findByRef(tasks, undefined)).toBeUndefined();
  });
  it('validates ref and tag', () => {
    expect(parseRef(' placar:ab-12 ')).toBe('placar:ab-12');
    expect(() => parseRef('a b')).toThrow(/invalid ref/);
    expect(parseTag('  Tainan ')).toBe('Tainan');
    expect(() => parseTag('x'.repeat(25))).toThrow(/too long/);
    expect(() => parseTag('  ')).toThrow(/empty/);
  });
});

describe('topOrder for new tasks', () => {
  it('goes below the current minimum of the column', () => {
    const tasks = [task({ id: 'a', column: 'today', order: 5 }), task({ id: 'b', column: 'today', order: 2 }), task({ id: 'c', column: 'week', order: -9 })];
    expect(topOrder(tasks, 'today')).toBeLessThan(2);
    expect(topOrder([], 'today')).toBe(0);
  });
});

describe('formatTaskList', () => {
  const tasks = [
    task({ id: 'aaaaaaaa1111', title: 'First', column: 'today', order: 1, difficulty: 2, description: '\nline one\nline two', links: [{ url: 'https://p.dev/1', label: 'PR' }] }),
    task({ id: 'bbbbbbbb2222', title: 'Recent', column: 'done', doneAt: NOW - DAY }),
    task({ id: 'cccccccc3333', title: 'Old', column: 'done', doneAt: NOW - 30 * DAY }),
  ];

  it('prints short id, difficulty, title, link count, description and links', () => {
    const out = formatTaskList(tasks, { now: NOW });
    expect(out).toContain('  aaaaaaaa  [2] First  (1 link)');
    expect(out).toContain('      line one');
    expect(out).toContain('      https://p.dev/1 (PR)');
  });

  it('hides old done tasks unless --all and skips empty columns', () => {
    const out = formatTaskList(tasks, { now: NOW });
    expect(out.join('\n')).not.toContain('Old');
    expect(out.join('\n')).toContain('1 older hidden');
    expect(out.some((l) => l.startsWith('Pendentes'))).toBe(false);
    expect(formatTaskList(tasks, { now: NOW, all: true }).join('\n')).toContain('Old');
  });

  it('shows an empty filtered column', () => {
    expect(formatTaskList(tasks, { col: 'week', now: NOW })).toEqual(['Semana (0)']);
  });
});

describe('sameTaskContent', () => {
  it('ignores order and timestamps but not content', () => {
    expect(sameTaskContent(task({ order: 1, updatedAt: 5 }), task({ order: 9, updatedAt: 7 }))).toBe(true);
    expect(sameTaskContent(task({}), task({ title: 'X' }))).toBe(false);
    expect(sameTaskContent(task({}), task({ links: [{ url: 'https://a.dev/' }] }))).toBe(false);
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const TSX = resolve(here, '../node_modules/.bin/tsx');
const CLI = resolve(here, 'deckctl.mts');

async function run(args: string[], tasks: PlannerTask[], onMsg: (m: { t: string; [k: string]: unknown }) => PlannerTask[] | null) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.once('listening', r));
  const board = (ws: WebSocket, list: PlannerTask[]) => ws.send(JSON.stringify({ t: 'planner-board', tasks: list }));
  wss.on('connection', (ws) => ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    if (m.t === 'planner-get') board(ws, tasks);
    else { const next = onMsg(m); if (next) board(ws, next); }
  }));
  const { port } = wss.address() as AddressInfo;
  try {
    return await new Promise<{ code: number | null; out: string }>((done) => {
      const p = spawn(TSX, [CLI, ...args], { env: { ...process.env, COCKPIT_PORT: String(port), COCKPIT_TOKEN: 'tok' } });
      let out = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { out += d; });
      p.on('close', (code) => done({ code, out }));
    });
  } finally { wss.close(); }
}

describe('deckctl task against a fake backend', () => {
  const existing = task({ id: 'exist-1', title: 'Fix login', column: 'today', order: 3 });

  it('add refuses a duplicate and names the existing id', async () => {
    const r = await run(['task', 'add', 'fix  LOGIN'], [existing], () => null);
    expect(r.code).toBe(1);
    expect(r.out).toContain('exist-1');
  });

  it('add sends an agent task on top of the column', async () => {
    let saved: PlannerTask | undefined;
    const r = await run(['task', 'add', 'New thing', '--col', 'today', '--diff', '2', '--link', 'https://a.dev', '--link', 'https://b.dev|B'], [existing], (m) => {
      saved = m.task as PlannerTask;
      return [existing, saved];
    });
    expect(r.code).toBe(0);
    expect(saved).toMatchObject({ title: 'New thing', column: 'today', difficulty: 2, source: 'agent' });
    expect(saved!.order).toBeLessThan(3);
    expect(saved!.links).toHaveLength(2);
  });

  it('add stores ref and tag, and refuses an existing ref', async () => {
    let saved: PlannerTask | undefined;
    const ok = await run(['task', 'add', 'Imported', '--ref', 'DFL-01498', '--tag', 'DFL'], [existing], (m) => {
      saved = m.task as PlannerTask;
      return [existing, saved];
    });
    expect(ok.code).toBe(0);
    expect(saved).toMatchObject({ ref: 'DFL-01498', tag: 'DFL' });
    const dup = await run(['task', 'add', 'Other title', '--ref', 'DFL-01498'], [existing, saved!], () => null);
    expect(dup.code).toBe(1);
    expect(dup.out).toContain(saved!.id);
  });

  it('done moves to done and appends links', async () => {
    let saved: PlannerTask | undefined;
    const r = await run(['task', 'done', 'exist', '--link', 'https://github.com/a/b/pull/1'], [existing], (m) => {
      saved = m.task as PlannerTask;
      return [saved];
    });
    expect(r.code).toBe(0);
    expect(saved).toMatchObject({ id: 'exist-1', column: 'done', links: [{ url: 'https://github.com/a/b/pull/1' }] });
  });

  it('rejects a bad column before connecting', async () => {
    const r = await run(['task', 'move', 'exist', 'nowhere'], [existing], () => null);
    expect(r.code).toBe(1);
    expect(r.out).toContain('invalid column');
  });
});
