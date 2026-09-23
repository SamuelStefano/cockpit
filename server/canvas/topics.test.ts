import { describe, it, expect } from 'vitest';
import { matchTopics, type MatchDoc } from './topics';
import { emptyTopics } from './refs';

const doc = (id: string, extra: Partial<MatchDoc> = {}): MatchDoc => ({ id, name: id.replace(/_/g, '-'), description: '', ...extra });

const docs: MatchDoc[] = [
  doc('hub_dfl'), doc('hub_deck'), doc('hub_pessoal'), doc('hub_itera'),
  doc('dfl_edge_functions'), doc('cockpit_ping_regression'), doc('samuel_saude_e_dinheiro', { description: 'dívida, saúde, dinheiro pessoal' }),
];

describe('matchTopics', () => {
  it('matches a repo dir token to the leaf that shares its family word', () => {
    const topics = { ...emptyTopics(), dirs: { cockpit: 4 } };
    const ids = matchTopics(topics, '', docs).map((m) => m.id);
    expect(ids).toContain('cockpit_ping_regression');
    expect(ids).toContain('hub_deck');
  });

  it('matches an mcp server token to its hub via the dfl family', () => {
    const topics = { ...emptyTopics(), mcp: { 'dfl-work': 6 } };
    const ids = matchTopics(topics, '', docs).map((m) => m.id);
    expect(ids).toContain('hub_dfl');
  });

  it('matches a skill token exactly to its leaf', () => {
    const topics = { ...emptyTopics(), skills: { 'dfl-edge-functions': 3 } };
    const ids = matchTopics(topics, '', docs).map((m) => m.id);
    expect(ids[0]).toBe('dfl_edge_functions');
  });

  it('uses the alias table for a repo with no matching prefix word', () => {
    const topics = { ...emptyTopics(), dirs: { divida: 5 } };
    const ids = matchTopics(topics, '', docs).map((m) => m.id);
    expect(ids).toContain('hub_pessoal');
  });

  it('does not match on noise: a rare one-off token below the score floor', () => {
    const topics = { ...emptyTopics(), dirs: { xyzunrelated: 1 } };
    expect(matchTopics(topics, '', docs)).toEqual([]);
  });

  it('caps results at the top-3 highest scores', () => {
    const topics = { dirs: { dfl: 10 }, skills: {}, mcp: {} };
    const many = [...docs, doc('dfl_a'), doc('dfl_b'), doc('dfl_c')];
    expect(matchTopics(topics, '', many).length).toBeLessThanOrEqual(3);
  });
});
