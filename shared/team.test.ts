import { describe, it, expect } from 'vitest';
import { validateBotInput, wouldCycle, botIdFromKey, botDraftKey, botThreadKey, newBotId } from './team';

const ok = { id: 'capo1', name: 'growth-lead', label: 'coo', instructions: 'x', mascot: { shape: 'tri', color: '#14B8A6' }, profile: 'full' };

describe('validateBotInput', () => {
  it('accepts a well-formed bot, normalizes color and drops server fields', () => {
    const r = validateBotInput({ ...ok, sessionId: 's', createdAt: 1, extra: true, primary: true, mode: 'auto' });
    expect(r).toEqual({ ok: true, bot: { ...ok, mascot: { shape: 'tri', color: '#14b8a6' }, primary: true, mode: 'auto' } });
  });
  it.each([
    ['no object', null],
    ['bad id', { ...ok, id: 'X!' }],
    ['empty name', { ...ok, name: '  ' }],
    ['name with space', { ...ok, name: 'growth lead' }],
    ['name over 40', { ...ok, name: 'a'.repeat(41) }],
    ['label over 60', { ...ok, label: 'a'.repeat(61) }],
    ['instructions over 8KB (bytes, not chars)', { ...ok, instructions: 'é'.repeat(4097) }],
    ['bad color', { ...ok, mascot: { shape: 'tri', color: '#fff' } }],
    ['bad shape', { ...ok, mascot: { shape: 'cube', color: '#ffffff' } }],
    ['bad profile', { ...ok, profile: 'root' }],
    ['self parent', { ...ok, parentId: 'capo1' }],
    ['bad mode', { ...ok, mode: 'bypassPermissions' }],
    ['model as flag', { ...ok, model: '--dangerously' }],
  ])('rejects %s', (_n, raw) => {
    expect(validateBotInput(raw).ok).toBe(false);
  });
  it('accepts accented names', () => {
    expect(validateBotInput({ ...ok, name: 'conversão' }).ok).toBe(true);
  });
});

describe('wouldCycle', () => {
  const bots = [{ id: 'a' }, { id: 'b', parentId: 'a' }, { id: 'c', parentId: 'b' }];
  it('detects a loop through the chain', () => {
    expect(wouldCycle(bots, 'a', 'c')).toBe(true);
    expect(wouldCycle(bots, 'a', 'a')).toBe(true);
  });
  it('allows a tree edge', () => {
    expect(wouldCycle(bots, 'c', 'a')).toBe(false);
    expect(wouldCycle(bots, 'a', undefined)).toBe(false);
  });
});

describe('bot keys', () => {
  it('round-trips draft and thread keys', () => {
    expect(botIdFromKey(botDraftKey('capo1'))).toBe('capo1');
    expect(botIdFromKey(botThreadKey('capo1'))).toBe('capo1');
    expect(botIdFromKey('new-abc')).toBeUndefined();
    expect(botIdFromKey('11111111-1111-1111-1111-111111111111')).toBeUndefined();
  });
  it('mints ids the validator accepts', () => {
    expect(validateBotInput({ ...ok, id: newBotId() }).ok).toBe(true);
  });
});
