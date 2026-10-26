import { describe, it, expect, vi, beforeEach } from 'vitest';

const fake = vi.hoisted(() => ({ exists: false, only: null as string | null }));
vi.mock('node:os', () => ({ homedir: () => '/home/x' }));
vi.mock('node:fs', () => ({ existsSync: (p: string) => fake.exists && (!fake.only || p.startsWith(fake.only)) }));

import { cliPath } from './cli-path';

describe('cliPath', () => {
  beforeEach(() => { process.env.PATH = '/usr/bin:/bin'; fake.only = null; });

  it('prefixa ~/.local/bin quando o CLI nativo existe', () => {
    fake.exists = true;
    fake.only = '/home/x/.local';
    expect(cliPath()).toBe('/home/x/.local/bin:/usr/bin:/bin');
  });

  it('acha o claude instalado em ~/.deck-npm/bin fora do PATH da unit', () => {
    fake.exists = true;
    fake.only = '/home/x/.deck-npm';
    expect(cliPath()).toBe('/home/x/.deck-npm/bin:/usr/bin:/bin');
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
