import { describe, it, expect } from 'vitest';
import { AGENT_PRESETS, type AgentView } from '../../shared/agents';
import { buildProviderCards } from './provider-onboarding';
import { buildOnboardingRows, anyProviderReady } from './onboarding-rows';

const item = (id: string, status: AgentView['status'], detail?: string): AgentView => ({ id, name: id, command: id, args: [], status, detail });

function rows(items: AgentView[], claudeReady = false, loaded = true, login?: Parameters<typeof buildOnboardingRows>[4]) {
  return buildOnboardingRows(buildProviderCards(AGENT_PRESETS, items, claudeReady), items, loaded, claudeReady, login);
}
const byId = (r: ReturnType<typeof rows>, id: string) => r.find((x) => x.id === id)!;

describe('buildOnboardingRows', () => {
  it('lists wired providers first and the future ones as em breve', () => {
    const r = rows([]);
    expect(r.map((x) => x.id)).toEqual(['claude', 'codex', 'gemini', 'grok', 'opencode', 'zai', 'deepseek', 'ollama', 'custom']);
    for (const id of ['zai', 'deepseek', 'ollama', 'custom']) expect(byId(r, id).state).toBe('soon');
  });

  it('maps Claude from readiness and login state', () => {
    expect(byId(rows([], true), 'claude').state).toBe('ready');
    expect(byId(rows([]), 'claude').state).toBe('install');
    expect(byId(rows([], false, true, { state: 'url', url: 'x' }), 'claude').state).toBe('waiting-login');
    expect(byId(rows([], false, true, { state: 'error', error: 'falhou' }), 'claude')).toMatchObject({ state: 'error', detail: 'falhou' });
  });

  it('maps agent CLIs to ready, waiting login, install, error and checking', () => {
    const r = rows([item('grok', 'ready'), item('codex', 'needs-login'), item('gemini', 'error', 'quebrou')]);
    expect(byId(r, 'grok').state).toBe('ready');
    expect(byId(r, 'codex')).toMatchObject({ state: 'waiting-login', command: 'codex login --device-auth' });
    expect(byId(r, 'gemini')).toMatchObject({ state: 'error', detail: 'quebrou' });
    expect(byId(r, 'opencode').state).toBe('install');
    expect(byId(rows([], false, false), 'opencode').state).toBe('checking');
  });

  it('anyProviderReady is true with Claude or any ready agent', () => {
    expect(anyProviderReady(false, [])).toBe(false);
    expect(anyProviderReady(true, [])).toBe(true);
    expect(anyProviderReady(false, [item('grok', 'ready')])).toBe(true);
  });
});
