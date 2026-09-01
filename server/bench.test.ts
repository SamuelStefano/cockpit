import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

// O registro do bench mora em `~/.cockpit/bench.json`, então sem isto o teste só
// passa na máquina de quem tem o alvo registrado — foi como o CI estreou vermelho.
// `os.homedir()` lê `$HOME` no POSIX, e o REGISTRY é resolvido no import: por isso
// a home falsa é montada antes, e o módulo entra por import dinâmico.
const HOME_REAL = process.env.HOME;
let bench: typeof import('./bench');
let insideRoot: typeof bench.insideRoot;
let isDepsDir: typeof bench.isDepsDir;
let buildBench: typeof bench.buildBench;
let home = '';
let root = '';
let fora = '';

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), 'deck-bench-home-'));
  root = mkdtempSync(join(tmpdir(), 'deck-bench-repo-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(home, '.cockpit'), { recursive: true });
  fora = join(mkdtempSync(join(tmpdir(), 'deck-bench-fora-')), 'segredo.ts');
  writeFileSync(fora, 'export default "x";\n');
  // `deps` aponta pro node_modules deste repo só pra o build achar react/react-dom;
  // o alvo em si é o diretório temporário.
  writeFileSync(
    join(home, '.cockpit', 'bench.json'),
    JSON.stringify({ 'alvo-teste': { root, deps: join(process.cwd(), 'node_modules') } }),
  );
  process.env.HOME = home;
  bench = await import('./bench');
  ({ insideRoot, isDepsDir, buildBench } = bench);
});

afterAll(() => {
  if (HOME_REAL === undefined) delete process.env.HOME;
  else process.env.HOME = HOME_REAL;
  for (const d of [home, root, join(fora, '..')]) rmSync(d, { recursive: true, force: true });
});

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
    expect(await buildBench('alvo-teste', '   ')).toMatchObject({ ok: false });
  });

  it('refuses code above the size cap', async () => {
    const res = await buildBench('alvo-teste', 'x'.repeat(129 * 1024));
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
      'alvo-teste',
      `import x from '${fora}';\nexport default () => x;`,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain('fora do repo do bench');
  });
});
