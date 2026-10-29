import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PointsEvent } from '../shared/protocol';
import {
  foldPoints, appendPointsEvent, readPointsLedger, readPoints,
  createEntry, correctPoints, noteEntry, deleteEntry, pointsFile,
} from './points';

// Constrói um evento com defaults sensatos pros testes puros do fold.
function ev(p: Partial<PointsEvent> & { entryId: string; kind: PointsEvent['kind'] }): PointsEvent {
  return { id: p.id ?? `${p.entryId}-${p.kind}-${p.at ?? 0}`, by: p.by ?? 'agent', at: p.at ?? 0, ...p };
}

describe('foldPoints (puro)', () => {
  it('create simples vira uma entry com points e originalPoints iguais', () => {
    const { entries, total } = foldPoints([ev({ entryId: 'a', kind: 'create', title: 'Task A', points: 5, at: 1 })]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ entryId: 'a', title: 'Task A', points: 5, originalPoints: 5, corrected: false, by: 'agent', deleted: false });
    expect(entries[0].history).toHaveLength(1);
    expect(total).toBe(5);
  });

  it('create + correct: points vira o corrigido, originalPoints preserva, corrected=true, history com 2', () => {
    const { entries, total } = foldPoints([
      ev({ entryId: 'a', kind: 'create', title: 'A', points: 5, by: 'agent', at: 1 }),
      ev({ entryId: 'a', kind: 'correct', points: 4, by: 'user', at: 2 }),
    ]);
    expect(entries[0]).toMatchObject({ points: 4, originalPoints: 5, corrected: true });
    expect(entries[0].history).toHaveLength(2);
    expect(entries[0].history[0]).toMatchObject({ kind: 'create', points: 5, by: 'agent' });
    expect(entries[0].history[1]).toMatchObject({ kind: 'correct', points: 4, by: 'user' });
    expect(total).toBe(4);
  });

  it('múltiplos entries ordenados por updatedAt desc', () => {
    const { entries } = foldPoints([
      ev({ entryId: 'a', kind: 'create', title: 'A', points: 3, at: 1 }),
      ev({ entryId: 'b', kind: 'create', title: 'B', points: 2, at: 2 }),
      ev({ entryId: 'a', kind: 'correct', points: 8, at: 3 }), // a re-sobe ao topo
    ]);
    expect(entries.map((e) => e.entryId)).toEqual(['a', 'b']);
  });

  it('delete some do fold mas não quebra o total dos demais', () => {
    const { entries, total } = foldPoints([
      ev({ entryId: 'a', kind: 'create', title: 'A', points: 3, at: 1 }),
      ev({ entryId: 'b', kind: 'create', title: 'B', points: 2, at: 2 }),
      ev({ entryId: 'a', kind: 'delete', at: 3 }),
    ]);
    expect(entries.map((e) => e.entryId)).toEqual(['b']);
    expect(total).toBe(2);
  });

  it('note edita a descrição e entra no history', () => {
    const { entries } = foldPoints([
      ev({ entryId: 'a', kind: 'create', title: 'A', points: 3, at: 1 }),
      ev({ entryId: 'a', kind: 'note', description: 'detalhe', by: 'user', at: 2 }),
    ]);
    expect(entries[0].description).toBe('detalhe');
    expect(entries[0].history).toHaveLength(2);
  });

  it('evento pra entryId sem create é ignorado', () => {
    const { entries } = foldPoints([ev({ entryId: 'ghost', kind: 'correct', points: 9, at: 1 })]);
    expect(entries).toHaveLength(0);
  });

  it('total soma os points visíveis (múltiplas correções)', () => {
    const { total } = foldPoints([
      ev({ entryId: 'a', kind: 'create', points: 5, at: 1 }),
      ev({ entryId: 'a', kind: 'correct', points: 4, at: 2 }),
      ev({ entryId: 'b', kind: 'create', points: 10, at: 3 }),
    ]);
    expect(total).toBe(14);
  });
});

describe('ledger I/O', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'points-'));
    process.env.COCKPIT_POINTS = join(dir, 'sub', 'points.jsonl');
  });
  afterEach(async () => {
    delete process.env.COCKPIT_POINTS;
    await rm(dir, { recursive: true, force: true });
  });

  it('appendPointsEvent cria id/entryId/at e escreve uma linha JSON', async () => {
    const out = await appendPointsEvent({ kind: 'create', title: 'X', points: 3, by: 'agent' });
    expect(out.id).toBeTruthy();
    expect(out.entryId).toBeTruthy();
    expect(out.at).toBeGreaterThan(0);
    const raw = await readFile(pointsFile(), 'utf8');
    expect(raw.trim().split('\n')).toHaveLength(1);
    expect(JSON.parse(raw.trim())).toMatchObject({ kind: 'create', title: 'X', points: 3 });
  });

  it('rejeita points fora do range', async () => {
    await expect(appendPointsEvent({ kind: 'create', title: 'X', points: -1, by: 'user' })).rejects.toThrow();
    await expect(appendPointsEvent({ kind: 'create', title: 'X', points: 999_999, by: 'user' })).rejects.toThrow();
  });

  it('capa strings longas', async () => {
    const out = await appendPointsEvent({ kind: 'create', title: 'a'.repeat(999), points: 1, description: 'b'.repeat(9999), by: 'user' });
    expect(out.title!.length).toBe(500);
    expect(out.description!.length).toBe(4000);
  });

  it('readPointsLedger ignora linhas corrompidas', async () => {
    await appendPointsEvent({ kind: 'create', title: 'ok', points: 2, by: 'agent' });
    const { appendFile } = await import('node:fs/promises');
    await appendFile(pointsFile(), 'isto não é json\n{"parcial":\n', 'utf8');
    await appendPointsEvent({ kind: 'create', title: 'ok2', points: 3, by: 'agent' });
    const events = await readPointsLedger();
    expect(events).toHaveLength(2);
  });

  it('helpers appendam e o fold reflete a trilha completa', async () => {
    const created = await createEntry({ title: 'Task', points: 5, by: 'agent' });
    await correctPoints(created.entryId, 4, 'user');
    await noteEntry(created.entryId, 'ajuste manual');
    const { entries, total } = await readPoints();
    expect(entries[0]).toMatchObject({ points: 4, originalPoints: 5, corrected: true, description: 'ajuste manual' });
    expect(entries[0].history).toHaveLength(3);
    expect(total).toBe(4);

    await deleteEntry(created.entryId);
    const after = await readPoints();
    expect(after.entries).toHaveLength(0);
    expect(after.total).toBe(0);
  });
});
