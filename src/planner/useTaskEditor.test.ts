import { describe, it, expect } from 'vitest';
import type { PlannerTask } from '../../shared/planner';
import { finalizeDraft, isHttpUrl } from './useTaskEditor';

const base: PlannerTask = { id: 'a', title: ' T ', description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0 };

describe('finalizeDraft', () => {
  it('trims, keeps valid ref and sends empty strings to clear', () => {
    expect(finalizeDraft({ ...base, tag: ' DFL ', ref: 'DFL-1' })).toMatchObject({ title: 'T', tag: 'DFL', ref: 'DFL-1' });
    expect(finalizeDraft(base)).toMatchObject({ tag: '', ref: '' });
    expect(finalizeDraft({ ...base, ref: 'bad ref' }).ref).toBe('');
  });

  it('sends an empty owner to clear it and keeps a set one', () => {
    expect(finalizeDraft(base).ownerBotId).toBe('');
    expect(finalizeDraft({ ...base, ownerBotId: 'b1' }).ownerBotId).toBe('b1');
  });

  it('drops non-http links', () => {
    const out = finalizeDraft({ ...base, links: [{ url: ' https://a.dev ' }, { url: 'nope' }] });
    expect(out.links).toEqual([{ url: 'https://a.dev' }]);
    expect(isHttpUrl('ftp://x')).toBe(false);
  });
});
