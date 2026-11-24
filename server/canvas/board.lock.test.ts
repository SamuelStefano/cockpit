import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateBoard, readBoard } from './board';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deck-board-lock-'));
  file = join(dir, 'canvas-board.json');
  process.env.COCKPIT_CANVAS_BOARD = file;
});
afterEach(() => {
  delete process.env.COCKPIT_CANVAS_BOARD;
  rmSync(dir, { recursive: true, force: true });
});

describe('updateBoard across processes', () => {
  it('waits while another process holds the board lock, then writes and releases it', async () => {
    writeFileSync(`${file}.lock`, '');          // the other Deck process mid-write
    const started = Date.now();
    setTimeout(() => rmSync(`${file}.lock`, { force: true }), 80);
    await updateBoard((b) => ({ ...b, cards: [] }));
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
    expect(existsSync(`${file}.lock`)).toBe(false);
    expect((await readBoard()).cards).toEqual([]);
  });

  it('reclaims a lock left behind by a process that died', async () => {
    writeFileSync(`${file}.lock`, '');
    const old = new Date(Date.now() - 60_000);
    utimesSync(`${file}.lock`, old, old);
    await updateBoard((b) => b);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });
});
