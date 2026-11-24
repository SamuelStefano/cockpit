import { describe, expect, it } from 'vitest';
import type { Message } from '../../shared/protocol';
import { lastAssistantModel, ranOnOtherModel, resolveSessionModel } from './session-model';

const user = (id: string): Message => ({ id, role: 'user', text: 'hi' });
const asst = (id: string, model?: string): Message => ({ id, role: 'assistant', blocks: [], ...(model ? { model } : {}) });

describe('resolveSessionModel', () => {
  it('shows the model of the last turn when the session has no override', () => {
    const msgs = [user('1'), asst('2', 'claude-fable-5-1'), user('3')];
    expect(resolveSessionModel(undefined, msgs, 'claude-sonnet-5-5')).toBe('claude-fable-5-1');
  });
  it('follows the session when switching between sessions', () => {
    const a = [asst('1', 'claude-fable-5-1')];
    const b = [asst('1', 'claude-opus-4-8')];
    expect(resolveSessionModel(undefined, a, 'x')).toBe('claude-fable-5-1');
    expect(resolveSessionModel(undefined, b, 'x')).toBe('claude-opus-4-8');
  });
  it('an explicit pick wins over the last turn, so the sent model matches the selector', () => {
    const msgs = [asst('1', 'claude-fable-5-1')];
    expect(resolveSessionModel('claude-sonnet-5-5', msgs, 'x')).toBe('claude-sonnet-5-5');
  });
  it('falls back to the default for empty sessions', () => {
    expect(resolveSessionModel(undefined, [], 'claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
    expect(resolveSessionModel(undefined, undefined, 'claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
  });
  it('skips assistant bubbles without a model', () => {
    expect(lastAssistantModel([asst('1', 'claude-opus-4-8'), asst('2')])).toBe('claude-opus-4-8');
  });
  it('ignores CLI pseudo-models like <synthetic>, which are not a version the next turn can run', () => {
    expect(lastAssistantModel([asst('1', 'claude-opus-4-8'), asst('2', '<synthetic>')])).toBe('claude-opus-4-8');
    expect(resolveSessionModel(undefined, [asst('1', '<synthetic>')], 'claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
  });
  it('keeps agent:* ids and strips the 1M variant', () => {
    expect(lastAssistantModel([asst('1', 'agent:gemini')])).toBe('agent:gemini');
    expect(lastAssistantModel([asst('1', 'claude-opus-5[1m]')])).toBe('claude-opus-5');
  });
});

describe('ranOnOtherModel', () => {
  it('reports the model the last turn actually ran on when it differs from the selected one (CLI fallback)', () => {
    expect(ranOnOtherModel('claude-fable-5-1', [asst('1', 'claude-sonnet-5-5')])).toBe('claude-sonnet-5-5');
  });
  it('is null when they match, ignoring 1M variants, or when nothing ran', () => {
    expect(ranOnOtherModel('claude-fable-5-1', [asst('1', 'claude-fable-5-1[1m]')])).toBeNull();
    expect(ranOnOtherModel('claude-fable-5-1', [])).toBeNull();
  });
});
