import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertOwnedBy, toFoldInput, writeSnapshotAtomic, OWNER_ID, FELLOW_ID } from './dfl-sync';
import { foldDflTree, dflSnapshotFile, readDflSnapshot } from './dfl-points';

function bundle(over: Record<string, unknown> = {}) {
  return {
    tasks: [{ id: 't1', name: 'A', status: 'done', points: 2, epic_id: 'e1', delivery_id: 'd1', owner_id: OWNER_ID }],
    deliveries: [{ id: 'd1', name: 'D', epic_id: 'e1', status: 'done', price_per_point: 75, transaction_id: null, owner_id: OWNER_ID }],
    epics: [{ id: 'e1', name: 'E', project_id: 'p1', status: 'active' }],
    projects: [{ id: 'p1', name: 'P' }],
    invoices: [{ id: 'i1', reference_month: '2026-05', status: 'paid', total_points: 2, total_amount_cents: 15000, paid_at: null, transaction_id: null, fellow_user_id: FELLOW_ID }],
    invoiceItems: [{ invoice_id: 'i1', source_id: 't1', points: 2, amount_cents: 15000 }],
    ...over,
  } as any;
}

describe('assertOwnedBy (guard de contrato)', () => {
  it('passa quando tudo é do Samuel', () => {
    expect(() => assertOwnedBy(bundle())).not.toThrow();
  });
  it('rejeita task de outro owner', () => {
    expect(() => assertOwnedBy(bundle({ tasks: [{ id: 'x', name: 'x', status: 'done', points: 1, epic_id: null, delivery_id: null, owner_id: 'OUTRO' }] }))).toThrow(/contrato violado/);
  });
  it('rejeita invoice de outro fellow', () => {
    expect(() => assertOwnedBy(bundle({ invoices: [{ id: 'i1', reference_month: '2026-05', status: 'paid', total_points: 1, total_amount_cents: 1, paid_at: null, transaction_id: null, fellow_user_id: 'OUTRO' }] }))).toThrow(/contrato violado/);
  });
  it('rejeita delivery de outro owner', () => {
    expect(() => assertOwnedBy(bundle({ deliveries: [{ id: 'd1', name: 'D', epic_id: 'e1', status: 'x', price_per_point: 1, transaction_id: null, owner_id: 'OUTRO' }] }))).toThrow(/contrato violado/);
  });
});

describe('toFoldInput', () => {
  it('remove owner_id/fellow_user_id do snapshot', () => {
    const fi = toFoldInput(bundle());
    expect(fi.tasks[0]).not.toHaveProperty('owner_id');
    expect(fi.deliveries[0]).not.toHaveProperty('owner_id');
    expect(fi.invoices[0]).not.toHaveProperty('fellow_user_id');
  });
});

describe('writeSnapshotAtomic', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'dfl-')); process.env.COCKPIT_DFL_POINTS = join(dir, 'dfl-points.json'); });
  afterEach(async () => { delete process.env.COCKPIT_DFL_POINTS; await rm(dir, { recursive: true, force: true }); });

  it('escreve 0600 e o arquivo lido não contém nenhum id de outro fellow', async () => {
    const snap = foldDflTree(toFoldInput(bundle()), 123);
    await writeSnapshotAtomic(snap);
    const st = await stat(dflSnapshotFile());
    expect(st.mode & 0o777).toBe(0o600);
    const raw = await readFile(dflSnapshotFile(), 'utf8');
    expect(raw).not.toContain('OUTRO');
    expect(raw).not.toContain('access_token');
    const back = await readDflSnapshot(123);
    expect(back?.totals.paidPoints).toBe(2);
  });
});
