import { describe, it, expect } from 'vitest';
import { insideRoot, buildBench } from './bench';

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
});
