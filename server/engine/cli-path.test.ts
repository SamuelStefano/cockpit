import { describe, it, expect, vi, beforeEach } from 'vitest';

const fake = vi.hoisted(() => ({ exists: false }));
vi.mock('node:os', () => ({ homedir: () => '/home/x' }));
vi.mock('node:fs', () => ({ existsSync: () => fake.exists }));

import { cliPath } from './cli-path';

describe('cliPath', () => {
  beforeEach(() => { process.env.PATH = '/usr/bin:/bin'; });

  it('prefixa ~/.local/bin quando o CLI nativo existe', () => {
    fake.exists = true;
    expect(cliPath()).toBe('/home/x/.local/bin:/usr/bin:/bin');
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
