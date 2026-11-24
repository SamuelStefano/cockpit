import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

const home = vi.hoisted(() => `${process.env.TMPDIR ?? '/tmp'}/deck-adminops-env-${process.pid}`);
vi.mock('node:os', async (orig) => ({ ...(await orig<typeof import('node:os')>()), homedir: () => home }));

const { setEnv, unsetEnv, managedEnvSync } = await import('./admin-ops');

const envFile = join(home, '.deck-agent', 'env.json');

function writeFromOtherBackend(env: Record<string, string>, mtime: number) {
  writeFileSync(envFile, JSON.stringify(env));
  utimesSync(envFile, mtime, mtime);
}

describe('managed env shared by both backends', () => {
  beforeEach(() => {
    rmSync(home, { recursive: true, force: true });
    mkdirSync(join(home, '.deck-agent'), { recursive: true });
  });

  it('drops a token the other backend removed', () => {
    writeFromOtherBackend({ GITHUB_TOKEN: 'leaked' }, 1_000);
    expect(managedEnvSync().GITHUB_TOKEN).toBe('leaked');
    writeFromOtherBackend({}, 2_000);
    expect(managedEnvSync().GITHUB_TOKEN).toBeUndefined();
  });

  it('never writes managed values into the backend process env', async () => {
    const before = process.env.PATH;
    await setEnv('PATH', '/managed/bin');
    expect(managedEnvSync().PATH).toBe('/managed/bin');
    expect(process.env.PATH).toBe(before);
    await unsetEnv('PATH');
    expect(managedEnvSync().PATH).toBeUndefined();
    expect(process.env.PATH).toBe(before);
  });
});
