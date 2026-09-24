import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { appendFileSync, mkdirSync, rmSync, writeFileSync, readFileSync, statSync, readSync } from 'node:fs';

const tmp = vi.hoisted(() => ({ dir: `${process.env.TMPDIR ?? '/tmp'}/deck-bgscan-${process.pid}` }));
vi.mock('node:os', async (orig) => ({ ...(await orig<typeof import('node:os')>()), tmpdir: () => tmp.dir }));
vi.mock('node:fs', async (orig) => {
  const fs = await orig<typeof import('node:fs')>();
  return { ...fs, readSync: vi.fn(fs.readSync), readFileSync: vi.fn(fs.readFileSync) };
});

import { scanSession, parseAgentFile, tasksDir } from './bg-agents';

const SID = 'sess-1';
const line = (o: object) => JSON.stringify(o) + '\n';
const user = line({ type: 'user', timestamp: '2026-09-24T10:00:00Z', message: { content: 'Audite o módulo de relé. Depois resuma.' } });
const turn = (tokens: number, stop: string | null, text = 'ok ✓') =>
  line({ type: 'assistant', timestamp: '2026-09-24T10:00:05Z', message: { usage: { input_tokens: tokens, output_tokens: 1 }, stop_reason: stop, content: [{ type: 'text', text }] } });

afterAll(() => rmSync(tmp.dir, { recursive: true, force: true }));

describe('scanSession incremental reads', () => {
  let file: string;
  beforeEach(() => {
    rmSync(tmp.dir, { recursive: true, force: true });
    mkdirSync(tasksDir(SID), { recursive: true });
    file = `${tasksDir(SID)}/a1.output`;
  });

  it('matches a whole-file parse while the file grows, even with a line split mid-character', () => {
    writeFileSync(file, user);
    const now = Date.now();
    expect(scanSession(SID, now)).toEqual([parseAgentFile('a1', readFileSync(file, 'utf8'), statSync(file).mtimeMs, now)]);
    const next = Buffer.from(turn(100, null) + turn(50, 'end_turn', 'pronto ✓'));
    const split = next.indexOf(Buffer.from('✓')) + 1; // inside the 3-byte ✓
    appendFileSync(file, next.subarray(0, split));
    expect(scanSession(SID, now)).toEqual([parseAgentFile('a1', readFileSync(file, 'utf8'), statSync(file).mtimeMs, now)]);
    appendFileSync(file, next.subarray(split));
    const whole = parseAgentFile('a1', readFileSync(file, 'utf8'), statSync(file).mtimeMs, now);
    expect(scanSession(SID, now)).toEqual([whole]);
    expect(whole).toMatchObject({ tokens: 152, status: 'done' });
  });

  it('does not read an unchanged file again', () => {
    writeFileSync(file, user + turn(10, 'end_turn'));
    scanSession(SID, Date.now());
    vi.mocked(readSync).mockClear();
    vi.mocked(readFileSync).mockClear();
    scanSession(SID, Date.now());
    expect(readSync).not.toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('starts over when the file is truncated', () => {
    writeFileSync(file, user + turn(10, null) + turn(10, null));
    scanSession(SID, Date.now());
    writeFileSync(file, user + turn(7, 'end_turn'));
    expect(scanSession(SID, Date.now())[0]).toMatchObject({ tokens: 8, status: 'done' });
  });
});
