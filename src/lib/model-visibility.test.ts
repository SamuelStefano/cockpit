import { describe, it, expect } from 'vitest';
import { familyKey, groupByFamily, isHidden, toggleHidden, visibleOptions } from './model-visibility';

const m = (id: string) => ({ id, displayName: id });
const ids = (opts: { id: string }[]) => opts.map((o) => o.id);

describe('isHidden', () => {
  it('a hidden family hides versions released later', () => {
    const hidden = [familyKey('haiku')];
    expect(isHidden('claude-haiku-4-5', hidden)).toBe(true);
    expect(isHidden('claude-haiku-9-1', hidden)).toBe(true);
    expect(isHidden('haiku', hidden)).toBe(true);
    expect(isHidden('claude-sonnet-5', hidden)).toBe(false);
  });

  it('a hidden id hides only that version', () => {
    const hidden = ['claude-opus-4-8'];
    expect(isHidden('claude-opus-4-8', hidden)).toBe(true);
    expect(isHidden('claude-opus-5', hidden)).toBe(false);
    expect(isHidden('opus', hidden)).toBe(false);
  });

  it('hides agents by id and never matches them as a family', () => {
    expect(isHidden('agent:grok', ['agent:grok'])).toBe(true);
    expect(isHidden('agent:gemini', ['agent:grok'])).toBe(false);
    expect(isHidden('agent:grok', [familyKey('grok')])).toBe(false);
  });
});

describe('toggleHidden', () => {
  it('adds and removes a key', () => {
    expect(toggleHidden([], 'agent:grok')).toEqual(['agent:grok']);
    expect(toggleHidden(['agent:grok', 'x'], 'agent:grok')).toEqual(['x']);
  });
});

describe('visibleOptions', () => {
  const opts = [m('claude-opus-5'), m('claude-opus-4-8'), m('claude-haiku-4-5'), m('agent:grok')];

  it('filters hidden families and ids', () => {
    const { options, allHidden } = visibleOptions(opts, [familyKey('haiku'), 'claude-opus-4-8'], 'claude-opus-5');
    expect(ids(options)).toEqual(['claude-opus-5', 'agent:grok']);
    expect(allHidden).toBe(false);
  });

  it('keeps the current model visible and flags it as hidden', () => {
    const { options } = visibleOptions(opts, [familyKey('haiku')], 'claude-haiku-4-5');
    expect(options[0]).toEqual({ id: 'claude-haiku-4-5', displayName: 'claude-haiku-4-5', hidden: true });
    expect(ids(options).filter((id) => id.includes('haiku'))).toEqual(['claude-haiku-4-5']);
  });

  it('keeps a current alias when its whole family is hidden', () => {
    const { options } = visibleOptions(opts, [familyKey('opus')], 'opus');
    expect(options[0]).toMatchObject({ id: 'opus', hidden: true });
  });

  it('does not re-add an alias still covered by a visible version', () => {
    const { options } = visibleOptions(opts, ['claude-opus-4-8'], 'opus');
    expect(ids(options)).not.toContain('opus');
  });

  it('shows everything when everything is hidden', () => {
    const { options, allHidden } = visibleOptions(opts, [familyKey('opus'), familyKey('haiku'), 'agent:grok'], 'claude-opus-5');
    expect(ids(options)).toEqual(ids(opts));
    expect(allHidden).toBe(true);
  });
});

describe('groupByFamily', () => {
  it('groups versions by family in first-seen order', () => {
    const groups = groupByFamily([m('claude-opus-5'), m('sonnet'), m('claude-opus-4-8'), m('claude-sonnet-5')]);
    expect(groups.map((g) => [g.family, ids(g.options)])).toEqual([
      ['opus', ['claude-opus-5', 'claude-opus-4-8']],
      ['sonnet', ['sonnet', 'claude-sonnet-5']],
    ]);
  });
});
