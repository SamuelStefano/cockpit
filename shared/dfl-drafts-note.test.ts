import { describe, it, expect } from 'vitest';
import { serializeDispatchNote, batchDispatchNotes, unitMarks, unitTasks, type DispatchUnit } from './dfl-drafts-note';
import { sanitizeDrafts, type DflDraft } from './dfl-drafts';

const draft = (id: string, n = 2): DflDraft => sanitizeDrafts([{
  id, title: `Épico ${id}`, status: 'draft', createdAt: 0,
  tasks: Array.from({ length: n }, (_, i) => ({ id: `${id}-t${i}`, title: `Task ${i} de ${id}`, points: 1.5, refs: i ? [`LS#${i}`] : [] })),
}])[0];

// Two deliveries: d1 = t0,t1 · d2 = t2
const split = (): DflDraft => sanitizeDrafts([{
  ...draft('ep-9', 3),
  deliveries: [{ id: 'd1', title: 'Front', taskIds: ['ep-9-t0', 'ep-9-t1'] }, { id: 'd2', title: 'Back', taskIds: ['ep-9-t2'] }],
}])[0];

describe('serializeDispatchNote', () => {
  it('carries exact titles, points, refs, the delivery grouping and the status callback', () => {
    const note = serializeDispatchNote([{ draft: draft('ep-1') }], 75);
    expect(note).toContain('### Épico ep-1 — 3 pt (R$ 225) [rascunho ep-1]');
    expect(note).toContain('#### Épico ep-1 // Samuel — 3 pt [dl-1]');
    expect(note).toContain('- Task 0 de ep-1 — 1,5 pt');
    expect(note).toContain('- Task 1 de ep-1 — LS#1 — 1,5 pt');
    expect(note).toContain('owner Samuel');
    expect(note).toContain('status done');
    expect(note).toContain('deck-drafts set-status ep-1 created');
  });

  it('sends only one delivery and asks to reuse an epic that may already exist', () => {
    const note = serializeDispatchNote([{ draft: split(), taskIds: ['ep-9-t2'] }], 75);
    expect(note).toContain('#### Back — 1,5 pt [d2]');
    expect(note).not.toContain('Front');
    expect(note).toContain('parte do rascunho (1 de 3 tasks)');
    expect(note).toContain('reuse-o');
    expect(note).toContain('set-status d2 created');
  });
});

describe('unitMarks', () => {
  it('names the epic, whole deliveries or loose tasks — whichever covers the unit exactly', () => {
    expect(unitMarks({ draft: split() })).toEqual(['ep-9']);
    expect(unitMarks({ draft: split(), taskIds: ['ep-9-t0', 'ep-9-t1'] })).toEqual(['d1']);
    expect(unitMarks({ draft: split(), taskIds: ['ep-9-t0', 'ep-9-t2'] })).toEqual(['ep-9-t0', 'd2']);
    expect(unitTasks({ draft: split(), taskIds: ['ep-9-t2', 'ep-9-t0'] }).map((t) => t.id)).toEqual(['ep-9-t0', 'ep-9-t2']);
  });
});

describe('batchDispatchNotes', () => {
  it('keeps everything in one note when it fits', () => {
    expect(batchDispatchNotes([{ draft: draft('a') }, { draft: draft('b') }], 75)).toHaveLength(1);
  });

  it('splits into batches under the byte limit, never dropping a unit', () => {
    const units: DispatchUnit[] = ['a', 'b', 'c', 'd'].map((id) => ({ draft: draft(id, 20) }));
    const batches = batchDispatchNotes(units, 75, 2_500);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat().map((u) => u.draft.id)).toEqual(['a', 'b', 'c', 'd']);
    for (const b of batches) if (b.length > 1) expect(new TextEncoder().encode(serializeDispatchNote(b, 75)).length).toBeLessThanOrEqual(2_500);
  });
});
