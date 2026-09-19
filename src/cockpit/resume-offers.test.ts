import { describe, it, expect } from 'vitest';
import { addOffer, clearOffer, type ResumeOffers } from './resume-offers';

describe('resume offers', () => {
  it('keeps one offer per session key', () => {
    const a = addOffer({}, 's1', 'external-kill', 'deploy');
    const b = addOffer(a, 's1', 'exhausted', 'já falhou');
    expect(Object.keys(b)).toEqual(['s1']);
    expect(b.s1.reason).toBe('exhausted');
    expect(b.s1.message).toBe('já falhou');
  });

  it('does not touch other sessions', () => {
    const offers = addOffer(addOffer({}, 's1', 'quota', 'sem janela'), 's2', 'ctx-hard', 'grande');
    expect(clearOffer(offers, 's1')).toEqual({ s2: { sessionKey: 's2', reason: 'ctx-hard', message: 'grande' } });
  });

  it('returns the same object when there is nothing to clear', () => {
    const offers: ResumeOffers = addOffer({}, 's1', 'quota', 'sem janela');
    expect(clearOffer(offers, 's9')).toBe(offers);
  });
});
