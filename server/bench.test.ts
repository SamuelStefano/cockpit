import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { insideRoot, isDepsDir, buildBench } from './bench';

describe('insideRoot', () => {
  it('accepts a file under the root', () => {
    expect(insideRoot('/repo', '/repo/src/App.tsx')).toBe(true);
  });

  it('rejects traversal out of the root', () => {
    expect(insideRoot('/repo', '/repo/../secrets/.claude.json')).toBe(false);
  });

  it('rejects a sibling whose name merely starts with the root', () => {
    expect(insideRoot('/repo', '/repo-evil/x.ts')).toBe(false);
  });

  it('rejects the root itself (only files under it are importable)', () => {
    expect(insideRoot('/repo', '/repo')).toBe(false);
  });
});

describe('isDepsDir', () => {
  it('accepts a real node_modules directory', () => {
    expect(isDepsDir(join(process.cwd(), 'node_modules'))).toBe(true);
  });

  it('rejects a directory that is not node_modules', () => {
    expect(isDepsDir(homedir())).toBe(false);
  });

  it('rejects a path that does not exist', () => {
    expect(isDepsDir('/nao/existe/node_modules')).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(isDepsDir(undefined)).toBe(false);
  });
});

describe('buildBench', () => {
  it('refuses empty code', async () => {
    expect(await buildBench('itera-player', '   ')).toMatchObject({ ok: false });
  });

  it('refuses code above the size cap', async () => {
    const res = await buildBench('itera-player', 'x'.repeat(129 * 1024));
    expect(res.ok).toBe(false);
    expect(res.error).toContain('128KB');
  });

  it('refuses a slug that is a path', async () => {
    const res = await buildBench('../../etc/passwd', 'export default () => null;');
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('alvo desconhecido') });
  });

  it('refuses an unregistered slug', async () => {
    const res = await buildBench('nao-existe-mesmo', 'export default () => null;');
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('alvo desconhecido') });
  });

  // Liberar o `node_modules` de fora não pode virar "qualquer caminho serve".
  it('still refuses a file outside both the root and the deps dir', async () => {
    const res = await buildBench(
      'itera-player',
      "import x from '/etc/hostname';\nexport default () => x;",
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain('fora do repo do bench');
  });
});
