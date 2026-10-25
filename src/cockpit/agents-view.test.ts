import { describe, expect, it } from 'vitest';
import { AGENT_PRESETS, type AgentView } from '../../shared/agents';
import { activeStepFor, bitStateForAgent, buildCards, customCards, customItems, customSaveGate, defaultSelection, monogram, newlyReady, parseCommandLine, phraseAt, progressFor, slugFromName, sortCards, splitArgs, tintFor } from './agents-view';

const view = (over: Partial<AgentView>): AgentView => ({ id: 'grok', name: 'Grok', command: 'grok', args: [], status: 'ready', ...over });

describe('agents-view', () => {
  it('maps status to the highlighted step', () => {
    expect(activeStepFor('not-installed')).toBe(0);
    expect(activeStepFor('needs-login')).toBe(1);
    expect(activeStepFor('ready')).toBe(2);
    expect(activeStepFor('unknown')).toBe(0);
    expect(activeStepFor('error')).toBe(2);
  });

  it('merges presets with connected items', () => {
    const cards = buildCards(AGENT_PRESETS, [view({ status: 'needs-login' })]);
    const grok = cards.find((c) => c.preset.id === 'grok')!;
    expect(grok.item).not.toBeNull();
    expect(grok.activeStep).toBe(1);
    const gemini = cards.find((c) => c.preset.id === 'gemini')!;
    expect(gemini.item).toBeNull();
    expect(gemini.status).toBe('unknown');
    expect(gemini.activeStep).toBe(0);
  });

  it('lists only non-preset items as custom', () => {
    const custom = view({ id: 'meu', name: 'Meu' });
    expect(customItems(AGENT_PRESETS, [view({}), custom])).toEqual([custom]);
  });

  it('splits args on whitespace', () => {
    expect(splitArgs('  acp  --x ')).toEqual(['acp', '--x']);
    expect(splitArgs('')).toEqual([]);
  });

  it('counts finished steps by status', () => {
    expect(progressFor('ready', true)).toBe(3);
    expect(progressFor('needs-login', true)).toBe(1);
    expect(progressFor('not-installed', true)).toBe(0);
    expect(progressFor('unknown', true)).toBe(0);
    expect(progressFor('ready', false)).toBe(0);
  });

  it('picks the mascot state for an agent', () => {
    expect(bitStateForAgent('ready', true, false)).toBe('thinking');
    expect(bitStateForAgent('ready', false, true)).toBe('happy');
    expect(bitStateForAgent('ready', false, false)).toBe('idle');
    expect(bitStateForAgent('needs-login', false, false)).toBe('connecting');
    expect(bitStateForAgent('not-installed', false, false)).toBe('sleeping');
    expect(bitStateForAgent('error', false, false)).toBe('error');
    expect(bitStateForAgent('unknown', false, false)).toBe('idle');
  });

  it('sorts ready, then connected, then the rest, keeping order', () => {
    const cards = buildCards(AGENT_PRESETS, [view({ id: 'codex', status: 'needs-login' }), view({ id: 'opencode', status: 'ready' })]);
    expect(sortCards(cards).map((c) => c.preset.id)).toEqual(['opencode', 'codex', 'grok', 'gemini', 'claude-code']);
  });

  it('selects the first connected unfinished agent, else Grok', () => {
    expect(defaultSelection(buildCards(AGENT_PRESETS, []))).toBe('grok');
    const cards = buildCards(AGENT_PRESETS, [view({ id: 'gemini', status: 'needs-login' }), view({ id: 'grok', status: 'ready' })]);
    expect(defaultSelection(cards)).toBe('gemini');
    expect(defaultSelection([])).toBeNull();
  });

  it('reports only transitions into ready', () => {
    const items = [view({ id: 'a', status: 'ready' }), view({ id: 'b', status: 'ready' }), view({ id: 'c', status: 'ready' })];
    expect(newlyReady({ a: 'needs-login', b: 'ready' }, items)).toEqual(['a']);
  });

  it('turns custom items into cards with the same three steps, using their own commands', () => {
    const cards = customCards(AGENT_PRESETS, [view({ id: 'meu', name: 'Meu', command: 'x', args: ['y'], install: 'npm i -g x' }), view({})]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ custom: true, status: 'ready' });
    expect(cards[0].preset.steps.map((s) => [s.kind, s.command])).toEqual([['install', 'npm i -g x'], ['login', undefined], ['test', undefined]]);
  });

  it('gives every preset install, login and test steps with commands', () => {
    for (const p of AGENT_PRESETS) {
      expect(p.steps.map((s) => s.kind)).toEqual(['install', 'login', 'test']);
      expect(p.steps[0].command).toBeTruthy();
      expect(p.steps[1].command).toBeTruthy();
    }
  });

  it('explains why the custom form is locked', () => {
    expect(customSaveGate(true, true, true)).toEqual({ allowed: true });
    expect(customSaveGate(true, false, false)).toEqual({ allowed: true });
    expect(customSaveGate(true, false, true)).toMatchObject({ allowed: false, reason: expect.stringMatching(/root/) });
    expect(customSaveGate(false, true, true)).toMatchObject({ allowed: false, reason: expect.stringMatching(/agents\.json/) });
  });

  it('splits a command line and slugs a name', () => {
    expect(parseCommandLine('  gemini --experimental-acp ')).toEqual({ command: 'gemini', args: ['--experimental-acp'] });
    expect(parseCommandLine('')).toEqual({ command: '', args: [] });
    expect(slugFromName('Meu Agente Ação!')).toBe('meu-agente-acao');
    expect(slugFromName('42 Coisa')).toBe('coisa');
    expect(slugFromName('x'.repeat(40))).toHaveLength(32);
  });

  it('cycles phrases and derives a stable tint and monogram', () => {
    expect(phraseAt(0)).not.toBe(phraseAt(1));
    expect(phraseAt(3)).toBe(phraseAt(0));
    expect(tintFor('grok')).toBe(tintFor('grok'));
    expect(monogram(' gemini')).toBe('G');
    expect(monogram('')).toBe('?');
  });
});
