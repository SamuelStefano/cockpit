import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// O lost update SÓ existe entre processos: as chamadas de fs aqui são síncronas, então
// dentro de um processo `load(); mutate; save()` nunca intercala e um teste normal
// passaria verde com ou sem a trava. Por isso este teste sobe processos de verdade.
const CHILDREN = 4;
const KEYS_PER_CHILD = 150;
// O boot do tsx leva ~1s e varia entre os filhos: sem alinhar o início cada um roda
// sozinho e não há corrida nenhuma pra observar.
const BOOT_MS = 4_000;

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-lock-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// `mode` escolhe entre a função travada e a versão crua (o código antes do fix) pra o
// mesmo teste provar que ele reprova sem a trava.
function childScript(mode: 'locked' | 'raw'): string {
  const awaiting = resolve(__dirname, 'awaiting.ts');
  const lock = resolve(__dirname, 'file-lock.ts');
  const body = mode === 'locked'
    ? `import { setAwaiting } from ${JSON.stringify(awaiting)};
       const add = setAwaiting;`
    : `import { readFileSync, writeFileSync, renameSync } from 'node:fs';
       const P = process.env.COCKPIT_AWAITING;
       const add = (k) => {
         let keys = [];
         try { keys = JSON.parse(readFileSync(P, 'utf8')); } catch {}
         if (keys.includes(k)) return;
         keys.push(k);
         const tmp = P + '.' + process.pid + '.tmp';
         writeFileSync(tmp, JSON.stringify(keys), 'utf8');
         renameSync(tmp, P);
       };`;
  return `${body}
    const tag = process.argv[2];
    const sleeper = new Int32Array(new SharedArrayBuffer(4));
    const startAt = Number(process.env.RACE_START_AT);
    while (Date.now() < startAt) Atomics.wait(sleeper, 0, 0, 5);
    for (let i = 0; i < ${KEYS_PER_CHILD}; i++) add(tag + '-' + i);
  `;
}

async function raceChildren(mode: 'locked' | 'raw'): Promise<Set<string>> {
  const target = join(dir, 'awaiting.json');
  const script = join(dir, `child-${mode}.mts`);
  writeFileSync(script, childScript(mode), 'utf8');
  const env = { ...process.env, COCKPIT_AWAITING: target, RACE_START_AT: String(Date.now() + BOOT_MS) };
  await Promise.all(
    Array.from({ length: CHILDREN }, (_, n) => new Promise<void>((done, fail) => {
      const p = spawn('npx', ['tsx', script, `c${n}`], { cwd: resolve(__dirname, '../..'), env, stdio: ['ignore', 'ignore', 'inherit'] });
      p.on('error', fail);
      p.on('close', (code) => (code === 0 ? done() : fail(new Error(`filho ${n} saiu ${code}`))));
    })),
  );
  try { return new Set<string>(JSON.parse(readFileSync(target, 'utf8'))); } catch { return new Set(); }
}

const expected = CHILDREN * KEYS_PER_CHILD;
const hasTsx = spawnSync('npx', ['tsx', '--version'], { stdio: 'ignore' }).status === 0;

describe.skipIf(!hasTsx)('withFileLock entre processos', () => {
  it('não perde nenhuma escrita de processos concorrentes', async () => {
    expect((await raceChildren('locked')).size).toBe(expected);
  }, 60_000);

  // Guarda do próprio teste: se um dia ele parar de gerar contenção de verdade, o
  // caso acima vira verde por acidente e a trava deixa de estar sendo testada.
  it('sem a trava, o mesmo cenário perde escritas', async () => {
    expect((await raceChildren('raw')).size).toBeLessThan(expected);
  }, 60_000);
});

describe('withFileLockAsync with a slow holder', () => {
  it('waits for a holder stalled past 0.5 s instead of writing over it unlocked', async () => {
    const { mkdtempSync, writeFileSync, rmSync: rm, existsSync } = await import('node:fs');
    const { join: j } = await import('node:path');
    const { tmpdir: td } = await import('node:os');
    const { withFileLockAsync } = await import('./file-lock');
    const dir = mkdtempSync(j(td(), 'deck-lockwait-'));
    const target = j(dir, 'board.json');
    writeFileSync(`${target}.lock`, ''); // the other process holds it
    setTimeout(() => rm(`${target}.lock`, { force: true }), 1500);
    const t0 = Date.now();
    let waited = 0;
    let lockedWhileRunning = false;
    await withFileLockAsync(target, async () => { waited = Date.now() - t0; lockedWhileRunning = existsSync(`${target}.lock`); });
    rm(dir, { recursive: true, force: true });
    expect(waited).toBeGreaterThanOrEqual(1400);
    expect(lockedWhileRunning).toBe(true);
  }, 10_000);
});
