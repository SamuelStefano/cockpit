import { describe, it, expect } from 'vitest';
import { serializeDraftsNote, batchDraftNotes } from './dfl-drafts-note';
import type { DflDraft } from './dfl-drafts';

const draft = (id: string, n = 2): DflDraft => ({
  id, title: `Épico ${id}`, status: 'draft', createdAt: 0,
  tasks: Array.from({ length: n }, (_, i) => ({ id: `${id}-t${i}`, title: `Task ${i} de ${id}`, points: 1.5, refs: i ? [`LS#${i}`] : [] })),
});

describe('serializeDraftsNote', () => {
  it('carries exact titles, points, refs, the delivery/owner rule and the status callback', () => {
    const note = serializeDraftsNote([draft('ep-1')], 75);
    expect(note).toContain('### Épico ep-1 — 3 pt (R$ 225) [rascunho ep-1]');
    expect(note).toContain('- Task 0 de ep-1 — 1,5 pt');
    expect(note).toContain('- Task 1 de ep-1 — LS#1 — 1,5 pt');
    expect(note).toContain('Uma delivery por épico; owner Samuel');
    expect(note).toContain('status done');
    expect(note).toContain('deck-drafts set-status <id-do-rascunho> created');
  });
});

describe('batchDraftNotes', () => {
  it('keeps everything in one note when it fits', () => {
    expect(batchDraftNotes([draft('a'), draft('b')], 75)).toHaveLength(1);
  });

  it('splits into batches under the byte limit, never dropping an epic', () => {
    const drafts = ['a', 'b', 'c', 'd'].map((id) => draft(id, 20));
    const batches = batchDraftNotes(drafts, 75, 2_500);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat().map((d) => d.id)).toEqual(['a', 'b', 'c', 'd']);
    for (const b of batches) if (b.length > 1) expect(new TextEncoder().encode(serializeDraftsNote(b, 75)).length).toBeLessThanOrEqual(2_500);
  });
});
