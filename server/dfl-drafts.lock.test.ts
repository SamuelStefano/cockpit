import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mutateDrafts, readDrafts } from './dfl-drafts';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deck-drafts-lock-'));
  file = join(dir, 'dfl-drafts.json');
  process.env.COCKPIT_DFL_DRAFTS = file;
});
afterEach(() => {
  delete process.env.COCKPIT_DFL_DRAFTS;
  rmSync(dir, { recursive: true, force: true });
});

const cli = resolve(__dirname, '..', 'scripts', 'deck-drafts');
function runCli(args: string[]): Promise<number> {
  return new Promise((res) => {
    const p = spawn(process.execPath, [cli, ...args], { env: { ...process.env, COCKPIT_DFL_DRAFTS: file }, stdio: 'ignore' });
    p.on('exit', (code) => res(code ?? -1));
  });
}

describe('dfl-drafts.json shared by the server and the deck-drafts CLI', () => {
  it('the server waits for a lock the CLI (or the other backend) holds', async () => {
    writeFileSync(`${file}.lock`, '');
    const started = Date.now();
    setTimeout(() => rmSync(`${file}.lock`, { force: true }), 80);
    await mutateDrafts({ op: 'add-epic', title: 'Servidor' });
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });

  it('the CLI waits for a lock the server holds, and neither write is lost', async () => {
    await mutateDrafts({ op: 'add-epic', title: 'Servidor' });
    writeFileSync(`${file}.lock`, '');
    setTimeout(() => rmSync(`${file}.lock`, { force: true }), 150);
    const started = Date.now();
    expect(await runCli(['add-epic', 'CLI'])).toBe(0);
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    expect((await readDrafts()).map((d) => d.title).sort()).toEqual(['CLI', 'Servidor']);
    expect(existsSync(`${file}.lock`)).toBe(false);
  }, 15_000);
});
