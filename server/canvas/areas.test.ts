import { describe, it, expect } from 'vitest';
import type { CanvasEdge, CanvasNode } from '../../shared/canvas';
import { classifyAreas } from './areas';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';

const hub = (id: string): CanvasNode => ({ id: `c:${id}`, kind: 'context', ref: id, title: id, subtitle: '', mtime: 1, hub: true });
const leaf = (id: string, mtime = 1): CanvasNode => ({ id: `c:${id}`, kind: 'context', ref: id, title: id, subtitle: '', mtime });
const session = (id: string): CanvasNode => ({ id: `s:${id}`, kind: 'session', ref: id, title: id, subtitle: '', mtime: 1 });
const link = (hubId: string, leafId: string): CanvasEdge => ({ source: `c:${hubId}`, target: `c:${leafId}`, kind: 'link' });

describe('classifyAreas', () => {
  it('names each hub by its own id prefix', () => {
    const nodes = [hub('hub_dfl'), hub('hub_dfl_revenue'), hub('hub_itera'), hub('hub_deck'), hub('hub_pessoal'), hub('hub_projetos_pessoais'), hub('hub_infra_integracoes'), hub('hub_mystery')];
    const areas = classifyAreas(nodes, []);
    expect(areas.get('c:hub_dfl')).toBe('dfl');
    expect(areas.get('c:hub_dfl_revenue')).toBe('dfl');
    expect(areas.get('c:hub_itera')).toBe('itera');
    expect(areas.get('c:hub_deck')).toBe('deck');
    expect(areas.get('c:hub_pessoal')).toBe('pessoal');
    expect(areas.get('c:hub_projetos_pessoais')).toBe('pessoal');
    expect(areas.get('c:hub_infra_integracoes')).toBe('infra');
    expect(areas.get('c:hub_mystery')).toBe('outros');
  });

  it('a leaf inherits its hub area through the link edge', () => {
    const nodes = [hub('hub_dfl'), leaf('dfl_revenue_ledger')];
    const edges = [link('hub_dfl', 'dfl_revenue_ledger')];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get('c:dfl_revenue_ledger')).toBe('dfl');
  });

  it('a leaf with no hub link stays unclassified', () => {
    const nodes = [hub('hub_dfl'), leaf('orphan_leaf')];
    const areas = classifyAreas(nodes, []);
    expect(areas.has('c:orphan_leaf')).toBe(false);
  });

  it('a leaf wikilinked from two hubs picks the alphabetically-first hub id, not edge order', () => {
    const nodes = [hub('hub_itera'), hub('hub_deck'), leaf('shared_leaf')];
    // Edge order deliberately puts the LOSING hub (itera) first: readContextDir's
    // readdir order is not guaranteed, so the winner must not depend on this.
    const edges = [link('hub_itera', 'shared_leaf'), link('hub_deck', 'shared_leaf')];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get('c:shared_leaf')).toBe('deck'); // 'hub_deck' < 'hub_itera'
  });

  it('a session votes for the area of the context it touched with a real tool call', () => {
    const nodes = [hub('hub_deck'), leaf('deck_layout'), session(S1)];
    const edges: CanvasEdge[] = [
      link('hub_deck', 'deck_layout'),
      { source: `s:${S1}`, target: 'c:deck_layout', kind: 'write' },
    ];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get(`s:${S1}`)).toBe('deck');
  });

  it('a session with only a topic guess still gets an area, weighted by the edge score', () => {
    const nodes = [hub('hub_itera'), leaf('itera_lesson'), session(S1)];
    const edges: CanvasEdge[] = [
      link('hub_itera', 'itera_lesson'),
      { source: `s:${S1}`, target: 'c:itera_lesson', kind: 'topic', weight: 0.4 },
    ];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get(`s:${S1}`)).toBe('itera');
  });

  it('a session touching two areas picks the one with the stronger evidence', () => {
    const nodes = [hub('hub_dfl'), leaf('dfl_x'), hub('hub_pessoal'), leaf('pessoal_x'), session(S1)];
    const edges: CanvasEdge[] = [
      link('hub_dfl', 'dfl_x'), link('hub_pessoal', 'pessoal_x'),
      { source: `s:${S1}`, target: 'c:dfl_x', kind: 'write' },
      { source: `s:${S1}`, target: 'c:dfl_x', kind: 'read' }, // a second real edge (different context in practice) — sum wins
      { source: `s:${S1}`, target: 'c:pessoal_x', kind: 'topic', weight: 0.3 },
    ];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get(`s:${S1}`)).toBe('dfl');
  });

  it('a real tie (same score, same recency) falls back to area id, deterministically', () => {
    const nodes = [hub('hub_deck'), leaf('deck_x'), hub('hub_itera'), leaf('itera_x'), session(S1)];
    const edges: CanvasEdge[] = [
      link('hub_deck', 'deck_x'), link('hub_itera', 'itera_x'),
      { source: `s:${S1}`, target: 'c:deck_x', kind: 'write' },
      { source: `s:${S1}`, target: 'c:itera_x', kind: 'write' },
    ];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get(`s:${S1}`)).toBe('deck'); // both leaves have mtime 1: same score, same recency, 'deck' < 'itera'
  });

  it('an EQUAL-score tie breaks on the most recently touched context, not on area id', () => {
    const nodes = [
      hub('hub_deck'), leaf('deck_x', 1), hub('hub_itera'), leaf('itera_x', 999), session(S1),
    ];
    const edges: CanvasEdge[] = [
      link('hub_deck', 'deck_x'), link('hub_itera', 'itera_x'),
      { source: `s:${S1}`, target: 'c:deck_x', kind: 'write' },
      { source: `s:${S1}`, target: 'c:itera_x', kind: 'write' },
    ];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get(`s:${S1}`)).toBe('itera'); // same score as deck, but itera_x is the more recent evidence
  });

  it('a session with no evidence at all still lands in outros, so it never escapes every budget', () => {
    const nodes = [session(S2)];
    const areas = classifyAreas(nodes, []);
    expect(areas.get(`s:${S2}`)).toBe('outros');
  });

  it('a card edge never votes (only read/write/topic to a context do) — falls back to outros', () => {
    const nodes: CanvasNode[] = [hub('hub_deck'), leaf('deck_x'), session(S1), { id: 'k:card1', kind: 'card', ref: 'card1', title: 't', subtitle: '', mtime: 1 }];
    const edges: CanvasEdge[] = [link('hub_deck', 'deck_x'), { source: 'k:card1', target: `s:${S1}`, kind: 'card' }];
    const areas = classifyAreas(nodes, edges);
    expect(areas.get(`s:${S1}`)).toBe('outros');
  });
});
