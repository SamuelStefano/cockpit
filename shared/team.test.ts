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
  it('accepts an ACP agent as the bot model', () => {
    expect(validateBotInput({ ...ok, model: 'agent:grok' })).toMatchObject({ ok: true, bot: { model: 'agent:grok' } });
  });
  it('refuses an ACP agent on a restricted bot (fatia E)', () => {
    expect(validateBotInput({ ...ok, profile: 'restricted', model: 'agent:grok' })).toEqual({ ok: false, error: expect.stringMatching(/agente externo/) });
    expect(validateBotInput({ ...ok, profile: 'restricted', model: 'haiku' }).ok).toBe(true);
  });
  it('accepts accented names', () => {
    expect(validateBotInput({ ...ok, name: 'conversão' }).ok).toBe(true);
  });
});

describe('bot project', () => {
  it('keeps a valid project slug and drops anything else', () => {
    expect(validateBotInput({ ...ok, project: 'corte-radar' })).toMatchObject({ ok: true, bot: { project: 'corte-radar' } });
    for (const bad of ['Itera', 'a b', '', 'x'.repeat(33), 5, null]) {
      const r = validateBotInput({ ...ok, project: bad });
      expect(r.ok && 'project' in r.bot).toBe(false);
    }
  });
});

describe('bot sprite', () => {
  it('keeps a valid sprite key and drops anything else', () => {
    expect(validateBotInput({ ...ok, sprite: 'workers' })).toMatchObject({ ok: true, bot: { sprite: 'workers' } });
    for (const bad of ['Workers', '../x', '', 'x'.repeat(25), 5, null]) {
      const r = validateBotInput({ ...ok, sprite: bad });
      expect(r.ok && 'sprite' in r.bot).toBe(false);
    }
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

describe('bot homeSeat', () => {
  it('keeps an integer 0..63 and drops anything else', () => {
    expect(validateBotInput({ ...ok, homeSeat: 0 })).toMatchObject({ ok: true, bot: { homeSeat: 0 } });
    expect(validateBotInput({ ...ok, homeSeat: 63 })).toMatchObject({ ok: true, bot: { homeSeat: 63 } });
    for (const bad of [-1, 64, 1.5, '2', null, NaN]) {
      const r = validateBotInput({ ...ok, homeSeat: bad });
      expect(r.ok && 'homeSeat' in r.bot).toBe(false);
    }
  });
});

describe('bot home', () => {
  it('keeps a valid building id and drops anything else', () => {
    expect(validateBotInput({ ...ok, home: 'corte-radar' })).toMatchObject({ ok: true, bot: { home: 'corte-radar' } });
    for (const bad of ['Deck', 'a b', '', 'x'.repeat(41), 5, null]) {
      const r = validateBotInput({ ...ok, home: bad });
      expect(r.ok && 'home' in r.bot).toBe(false);
    }
  });
});
