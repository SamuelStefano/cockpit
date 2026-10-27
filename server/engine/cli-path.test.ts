import { describe, it, expect, vi, beforeEach } from 'vitest';

const fake = vi.hoisted(() => ({ exists: false, only: null as string[] | null }));
vi.mock('node:os', () => ({ homedir: () => '/home/x' }));
vi.mock('node:fs', () => ({ existsSync: (p: string) => fake.exists && (!fake.only || fake.only.some((o) => p.startsWith(o))) }));

import { cliPath, resolveCli, setPreferredCliDir } from './cli-path';

describe('cliPath', () => {
  beforeEach(() => { process.env.PATH = '/usr/bin:/bin'; fake.only = null; setPreferredCliDir(null); });

  it('prefixa ~/.local/bin quando o CLI nativo existe', () => {
    fake.exists = true;
    fake.only = ['/home/x/.local'];
    expect(cliPath()).toBe('/home/x/.local/bin:/usr/bin:/bin');
  });

  it('acha o claude instalado em ~/.deck-npm/bin fora do PATH da unit', () => {
    fake.exists = true;
    fake.only = ['/home/x/.deck-npm'];
    expect(cliPath()).toBe('/home/x/.deck-npm/bin:/usr/bin:/bin');
  });

  it('o prefixo gerenciado vence o nativo', () => {
    fake.exists = true;
    fake.only = ['/home/x/.deck-npm', '/home/x/.local'];
    expect(cliPath()).toBe('/home/x/.deck-npm/bin:/home/x/.local/bin:/usr/bin:/bin');
  });

  it('um diretório preferido (install mais novo) vem antes de tudo', () => {
    fake.exists = true;
    fake.only = ['/home/x/.deck-npm', '/home/x/.deck-node'];
    setPreferredCliDir('/home/x/.deck-node/bin');
    expect(cliPath()).toBe('/home/x/.deck-node/bin:/home/x/.deck-npm/bin:/usr/bin:/bin');
  });

  it('mantém o PATH intacto sem CLI nativo', () => {
    fake.exists = false;
    expect(cliPath()).toBe('/usr/bin:/bin');
  });

  it('não devolve undefined sem PATH no ambiente', () => {
    fake.exists = false;
    delete process.env.PATH;
    expect(cliPath()).toBe('');
  });
});

describe('resolveCli', () => {
  it('devolve o primeiro claude do PATH', () => {
    const has = new Set(['/b/claude', '/c/claude']);
    expect(resolveCli('/a:/b:/c', (p) => has.has(p))).toBe('/b/claude');
  });

  it('vazio sem claude', () => {
    expect(resolveCli('/a:/b', () => false)).toBe('');
  });
});
