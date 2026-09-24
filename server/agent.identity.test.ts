import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

afterEach(() => { vi.unstubAllEnvs(); });

describe('saveIdentity', () => {
  it('writes the private key 0600 in a 0700 dir from the start', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'deck-agent-')), 'agent');
    vi.stubEnv('DECK_AGENT_DIR', dir);
    vi.resetModules();
    const { saveIdentity } = await import('./agent');
    saveIdentity({ agentId: 'a', privateKeyPem: 'k', publicKey: 'p' } as never);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, 'identity.json')).mode & 0o777).toBe(0o600);
  });
});
