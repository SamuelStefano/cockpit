import { describe, expect, it } from 'vitest';
import type { AgentView } from '../shared/agents';
import type { DflMcpsState } from '../shared/dfl-mcps';
import type { TeamBot } from '../shared/protocol';
import {
  agentConnection, claudeProvider, deviceConnections, listConnections, machineConnections, mcpConnections, safeDetail,
} from './connections';

const bot = (id: string, model?: string) => ({ id, model }) as TeamBot;
const agent = (status: AgentView['status'], extra: Partial<AgentView> = {}) =>
  ({ id: 'grok', name: 'Grok', command: 'grok', args: [], status, ...extra }) as AgentView;

describe('claude provider', () => {
  it('maps credentials and auth hold to a state', () => {
    expect(claudeProvider([], false, false).state).toBe('off');
    expect(claudeProvider([], true, true).state).toBe('expired');
    expect(claudeProvider([], true, false).state).toBe('connected');
  });
  it('is used by bots that are not on an external agent', () => {
    expect(claudeProvider([bot('a'), bot('b', 'agent:grok'), bot('c', 'opus')], true, false).usedBy).toEqual(['a', 'c']);
  });
});

describe('acp agents', () => {
  it.each([
    ['ready', 'connected'], ['needs-login', 'expired'], ['error', 'error'], ['not-installed', 'off'], ['unknown', 'off'],
  ] as const)('%s -> %s', (status, state) => {
    expect(agentConnection(agent(status), []).state).toBe(state);
  });
  it('lists the bots on agent:<id>', () => {
    expect(agentConnection(agent('ready'), [bot('a', 'agent:grok'), bot('b', 'agent:gemini')]).usedBy).toEqual(['a']);
  });
});

describe('mcp hosts', () => {
  const host = (status: DflMcpsState['hosts'][number]['status']) => ({ host: 'work', endpoint: 'e', name: 'dfl-work', status });
  it.each([
    ['connected', 'connected'], ['needs-auth', 'expired'], ['failed', 'error'], ['missing', 'off'],
  ] as const)('%s -> %s', (status, state) => {
    expect(mcpConnections({ hosts: [host(status)], source: 'manifest' })[0]).toMatchObject({ kind: 'tool', state });
  });
  it('carries the list error as the detail', () => {
    const [c] = mcpConnections({ hosts: [host('failed')], source: 'fallback', error: 'could not run' });
    expect(c.detail).toBe('could not run');
  });
});

describe('machines and devices', () => {
  it('marks this machine connected and boxes by presence', () => {
    const out = machineConnections({ label: 'vps', now: 5 }, [
      { id: 'b1', label: 'PC', online: false, lastSeen: '2026-10-01T00:00:00Z' },
      { id: 'b2', label: 'VPS2', online: true, lastSeen: null },
    ]);
    expect(out.map((c) => c.state)).toEqual(['connected', 'off', 'connected']);
    expect(out[1].lastUsed).toBe(Date.parse('2026-10-01T00:00:00Z'));
    expect(out[2].lastUsed).toBeUndefined();
  });
  it('exposes only an 8-char id prefix of a device key and its lastSeen', () => {
    const pub = 'ab'.repeat(32);
    const [c] = deviceConnections([{ pub, label: 'Phone', addedAt: 'x', lastSeen: '2026-10-02T00:00:00Z', pin: 'cd'.repeat(32) }]);
    expect(c).toEqual({ id: 'device:abababab', kind: 'device', label: 'Phone', state: 'connected', lastUsed: Date.parse('2026-10-02T00:00:00Z') });
  });
});

describe('payload safety', () => {
  const secrets = [
    'sk-ant-api03-AAAAAAAAAAAAAAAAAAAA', 'ghp_abcdefghijklmnopqrstuvwxyz0123', 'Bearer abc.def.ghi',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig', 'a'.repeat(64), 'https://x/cb?access_token=hunter2hunter2',
  ];
  it('scrubs secret-looking text from details', () => {
    for (const s of secrets) {
      const out = safeDetail(`failed with ${s} here`)!;
      expect(out).not.toContain(s.replace(/^.*=/, ''));
      expect(out).toContain('[removido]');
    }
  });
  it('the whole payload carries no secret-looking string', async () => {
    const pub = 'f0'.repeat(32);
    const items = await listConnections({
      team: async () => [bot('a', 'agent:grok')],
      agents: () => [agent('error', { detail: `boom ${secrets[0]} ${secrets[4]}` })],
      mcps: async () => ({ hosts: [{ host: 'work', endpoint: 'e', name: 'dfl-work', status: 'failed', detail: secrets[1] }], source: 'manifest' }),
      devices: () => [{ pub, label: 'Phone', addedAt: 'x', pin: 'cd'.repeat(32) }],
      boxes: () => [],
      claudePresent: () => true, claudeHeld: () => false, hostLabel: () => 'vps', now: () => 1,
    });
    const json = JSON.stringify(items);
    for (const s of secrets) expect(json).not.toContain(s);
    expect(json).not.toContain(pub);
    expect(json).not.toContain('cd'.repeat(32));
    expect(json).not.toMatch(/[A-Za-z0-9+/_-]{40,}/);
    expect(json).not.toMatch(/\b(?:sk|ghp|xox[abp])[-_][A-Za-z0-9]{8,}/);
  });
  it('a failing source degrades to empty instead of throwing', async () => {
    const items = await listConnections({
      team: async () => { throw new Error('x'); }, agents: () => { throw new Error('x'); },
      mcps: async () => { throw new Error('x'); }, devices: () => { throw new Error('x'); },
      claudePresent: () => false, claudeHeld: () => false, hostLabel: () => 'h', now: () => 1,
    });
    expect(items.map((c) => c.id)).toEqual(['provider:claude', 'machine:self']);
  });
});
