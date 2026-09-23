import { describe, it, expect } from 'vitest';
import { parseDraftsMarkdown, splitRefs } from './dfl-drafts-md';

const MD = `Registrar no DFL a maratona. Intro que não é épico.

## Épico 1 — Lesson Studio: canvas engine (tracks, fórmulas, behaviours) — 8 pt
- Keyframe tracks por box (spec v2, runtime, sampling) — LS#577 — 5
- Cópia do contrato no render e no MCP — services#222–#224, mcp#486–#490 — 1.5
- Revisão/orquestração da cadeia (rebases, verificação adversarial) — 1,5

## Épico 2 — Campaigns — 9 pt
- Aviso no Discord — campaigns#84, #102 — 2
- Storybook — website#85/#86, learn#377/#378 — 3
- linha sem pontos no fim — LS#1
`;

describe('parseDraftsMarkdown', () => {
  it('reads epics, tasks, refs and decimal points (dot or comma)', () => {
    const { epics } = parseDraftsMarkdown(MD);
    expect(epics.map((e) => [e.title, e.declaredPoints, e.tasks.length])).toEqual([
      ['Lesson Studio: canvas engine (tracks, fórmulas, behaviours)', 8, 3],
      ['Campaigns', 9, 2],
    ]);
    expect(epics[0].tasks).toEqual([
      { title: 'Keyframe tracks por box (spec v2, runtime, sampling)', points: 5, refs: ['LS#577'] },
      { title: 'Cópia do contrato no render e no MCP', points: 1.5, refs: ['services#222–#224', 'mcp#486–#490'] },
      { title: 'Revisão/orquestração da cadeia (rebases, verificação adversarial)', points: 1.5, refs: [] },
    ]);
  });

  it('warns about skipped lines and header totals that disagree with the tasks', () => {
    const { warnings } = parseDraftsMarkdown(MD);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/linha ignorada/);
    expect(warnings[1]).toMatch(/"Campaigns": cabeçalho diz 9 pt, tasks somam 5 pt/);
  });

  it('accepts a header without the "Épico N" prefix and without points', () => {
    const { epics } = parseDraftsMarkdown('## Só título\n- t — 1');
    expect(epics[0]).toMatchObject({ title: 'Só título', declaredPoints: null });
  });

  it('ignores bullets before the first epic', () => {
    expect(parseDraftsMarkdown('- solto — 3\n').epics).toEqual([]);
  });
});

describe('splitRefs', () => {
  it('inherits the repo prefix for bare #N and slash lists', () => {
    expect(splitRefs('campaigns#84, #102')).toEqual(['campaigns#84', 'campaigns#102']);
    expect(splitRefs('website#85/#86, learn#377/#378/#379')).toEqual(['website#85', 'website#86', 'learn#377', 'learn#378', 'learn#379']);
    expect(splitRefs('~25 PRs')).toEqual(['~25 PRs']);
  });
});
