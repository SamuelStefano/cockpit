// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { AGENT_PRESETS, type AgentView } from '../../shared/agents';
import { buildProviderCards, defaultProviderSelection, requestAgentFocus, setupTargets, takeAgentFocus, toggleProvider } from './provider-onboarding';

const view = (id: string, status: AgentView['status']): AgentView => ({ id, name: id, command: id, args: [], preset: id, status });

describe('buildProviderCards', () => {
  it('lists Claude, Grok, OpenCode Go, Codex and Gemini in that order', () => {
    const cards = buildProviderCards(AGENT_PRESETS, [], true);
    expect(cards.map((c) => c.label)).toEqual(['Claude', 'Grok', 'OpenCode Go', 'Codex', 'Gemini']);
  });
  it('reads Claude from the login state and agents from the probe', () => {
    const cards = buildProviderCards(AGENT_PRESETS, [view('grok', 'ready'), view('codex', 'needs-login'), view('opencode', 'not-installed')], false);
    const by = Object.fromEntries(cards.map((c) => [c.id, c.status]));
    expect(by).toMatchObject({ claude: 'needs-login', grok: 'ready', codex: 'needs-login', opencode: 'missing', gemini: 'unknown' });
  });
  it('carries the existing install command and never flags a preset with one as soon', () => {
    const grok = buildProviderCards(AGENT_PRESETS, [], true).find((c) => c.id === 'grok')!;
    expect(grok.install).toContain('x.ai/cli/install.sh');
    expect(grok.soon).toBe(false);
  });
  it('flags a provider without an install command as soon', () => {
    const presets = AGENT_PRESETS.map((p) => (p.id === 'codex' ? { ...p, install: undefined } : p));
    expect(buildProviderCards(presets, [], true).find((c) => c.id === 'codex')!.soon).toBe(true);
  });
});

describe('selection', () => {
  it('suggests Claude only while it is not ready', () => {
    expect(defaultProviderSelection(buildProviderCards(AGENT_PRESETS, [], false))).toEqual(['claude']);
    expect(defaultProviderSelection(buildProviderCards(AGENT_PRESETS, [], true))).toEqual([]);
  });
  it('toggles multiple providers and allows leaving Claude out', () => {
    expect(toggleProvider(['claude'], 'grok')).toEqual(['claude', 'grok']);
    expect(toggleProvider(['claude', 'grok'], 'claude')).toEqual(['grok']);
  });
  it('returns the selected cards in card order', () => {
    const cards = buildProviderCards(AGENT_PRESETS, [], false);
    expect(setupTargets(cards, ['codex', 'claude']).map((c) => c.id)).toEqual(['claude', 'codex']);
  });
});

describe('agent focus', () => {
  it('hands the requested preset over once', () => {
    requestAgentFocus('opencode');
    expect(takeAgentFocus()).toBe('opencode');
    expect(takeAgentFocus()).toBeNull();
  });
});
