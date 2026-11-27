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
    const { saveIdentity } = await import('./agent-main');
    saveIdentity({ agentId: 'a', privateKeyPem: 'k', publicKey: 'p' } as never);
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    expect(statSync(join(dir, 'identity.json')).mode & 0o777).toBe(0o600);
  });
});

describe('pairAgent', () => {
  it('pairs with a fresh key and a label, and keeps the old identity until the relay confirms', async () => {
    const { WebSocketServer } = await import('ws');
    const dir = join(mkdtempSync(join(tmpdir(), 'deck-agent-')), 'agent');
    vi.stubEnv('DECK_AGENT_DIR', dir);
    vi.resetModules();
    const { pairAgent, saveIdentity, loadIdentity, generateIdentityKeys } = await import('./agent-main');
    const old = { agentId: 'old', ...generateIdentityKeys() };
    saveIdentity(old);
    const wss = new WebSocketServer({ port: 0 });
    const seen: Array<{ publicKey: string; label: string }> = [];
    let answer: 'paired' | 'limit' = 'limit';
    wss.on('connection', (ws) => ws.on('message', (raw) => {
      seen.push(JSON.parse(raw.toString()));
      if (answer === 'limit') ws.close(4429, 'box limit');
      else ws.send(JSON.stringify({ t: 'paired', agentId: 'new' }));
    }));
    const url = `ws://127.0.0.1:${(wss.address() as import('node:net').AddressInfo).port}`;
    await expect(pairAgent(url, 'c1', 'pc')).rejects.toThrow(/limite de máquinas/);
    expect(loadIdentity()?.agentId).toBe('old');
    answer = 'paired';
    await pairAgent(url, 'c2', 'pc');
    expect(seen.map((m) => m.label)).toEqual(['pc', 'pc']);
    expect(seen[1].publicKey).not.toBe(old.publicKey);
    expect(loadIdentity()).toMatchObject({ agentId: 'new', publicKey: seen[1].publicKey });
    wss.close();
  });
});
