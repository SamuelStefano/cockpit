import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { foldDflTree, readDflSnapshot, deriveStale, dflSnapshotFile, STALE_MS, type DflRawInput } from './dfl-points';

// Fixture mínima espelhando o modelo real do DFL: projeto›épico›delivery›task, e
// invoice_items reconciliando task paga (source_id = task.id).
function input(over: Partial<DflRawInput> = {}): DflRawInput {
  return {
    projects: [{ id: 'proj1', name: 'Revenue' }],
    epics: [{ id: 'epic1', name: 'Cobranças', project_id: 'proj1', status: 'active' }],
    deliveries: [{ id: 'del1', name: 'Dunning', epic_id: 'epic1', status: 'done', price_per_point: 75, transaction_id: 'tx1' }],
    tasks: [
      { id: 't-paid', name: 'Task paga', status: 'done', points: 5, epic_id: 'epic1', delivery_id: 'del1' },
      { id: 't-open', name: 'Task aberta', status: 'done', points: 3, epic_id: 'epic1', delivery_id: 'del1' },
      { id: 't-todo', name: 'Task a fazer', status: 'to_do', points: 2, epic_id: 'epic1', delivery_id: 'del1' },
    ],
    invoices: [{ id: 'inv1', reference_month: '2026-05', status: 'paid', total_points: 5, total_amount_cents: 37500, paid_at: '2026-05-10', transaction_id: 'txp' }],
    invoiceItems: [{ invoice_id: 'inv1', source_id: 't-paid', points: 5, amount_cents: 37500 }],
    ...over,
  };
}

describe('foldDflTree (puro)', () => {
  it('classifica pago/aberto/a-fazer e soma os totais', () => {
    const s = foldDflTree(input(), 1000);
    expect(s.totals).toMatchObject({
      paidPoints: 5, paidAmountCents: 37500,
      openPoints: 3, amountOpenCents: 3 * 75 * 100,
      todoPoints: 2, totalPoints: 10,
    });
    expect(s.syncedAt).toBe(1000);
    expect(s.stale).toBe(false);
  });

  it('task paga usa amount do invoice_item; aberta/a-fazer estima por price_per_point', () => {
    const s = foldDflTree(input(), 0);
    const tasks = s.projects[0].epics[0].deliveries[0].tasks;
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    expect(byId['t-paid']).toMatchObject({ status: 'paid', amountCents: 37500 });
    expect(byId['t-open']).toMatchObject({ status: 'open', amountCents: 22500 });
    expect(byId['t-todo']).toMatchObject({ status: 'todo', amountCents: 15000 });
  });

  it('reconciliação: task só é paga se o item vem de invoice paga', () => {
    const s = foldDflTree(input({
      invoices: [{ id: 'inv1', reference_month: '2026-05', status: 'open', total_points: 5, total_amount_cents: 37500, paid_at: null, transaction_id: null }],
    }), 0);
    // invoice não-paga: a task antes paga vira "aberta" (done, não faturada)
    expect(s.totals.paidPoints).toBe(0);
    expect(s.totals.openPoints).toBe(8);
  });

  it('monta a árvore projeto›épico›delivery›task', () => {
    const s = foldDflTree(input(), 0);
    expect(s.projects).toHaveLength(1);
    expect(s.projects[0]).toMatchObject({ id: 'proj1', name: 'Revenue', points: 10 });
    expect(s.projects[0].epics[0]).toMatchObject({ id: 'epic1', name: 'Cobranças' });
    expect(s.projects[0].epics[0].deliveries[0]).toMatchObject({ id: 'del1', name: 'Dunning', pricePerPoint: 75, transactionId: 'tx1' });
    expect(s.projects[0].epics[0].deliveries[0].tasks).toHaveLength(3);
  });

  it('task sem delivery/épico/projeto cai em buckets "Sem …"', () => {
    const s = foldDflTree(input({
      tasks: [{ id: 'orf', name: 'Órfã', status: 'done', points: 4, epic_id: null, delivery_id: null }],
      invoiceItems: [], invoices: [],
    }), 0);
    expect(s.projects[0].name).toBe('Sem projeto');
    expect(s.projects[0].epics[0].name).toBe('Sem épico');
    expect(s.projects[0].epics[0].deliveries[0].name).toBe('Sem delivery');
    expect(s.projects[0].epics[0].deliveries[0].pricePerPoint).toBe(75);
    expect(s.totals.openPoints).toBe(4);
  });

  it('price_per_point ausente/zero cai no fallback 75', () => {
    const s = foldDflTree(input({
      deliveries: [{ id: 'del1', name: 'D', epic_id: 'epic1', status: 'x', price_per_point: null, transaction_id: null }],
      tasks: [{ id: 'o', name: 'o', status: 'done', points: 2, epic_id: 'epic1', delivery_id: 'del1' }],
      invoices: [], invoiceItems: [],
    }), 0);
    expect(s.totals.amountOpenCents).toBe(2 * 75 * 100);
  });

  it('invoices ordenadas por reference_month desc', () => {
    const s = foldDflTree(input({
      invoices: [
        { id: 'a', reference_month: '2026-03', status: 'paid', total_points: 1, total_amount_cents: 100, paid_at: null, transaction_id: null },
        { id: 'b', reference_month: '2026-07', status: 'paid', total_points: 1, total_amount_cents: 100, paid_at: null, transaction_id: null },
      ],
      invoiceItems: [],
    }), 0);
    expect(s.invoices.map((i) => i.referenceMonth)).toEqual(['2026-07', '2026-03']);
  });
});

describe('deriveStale', () => {
  it('fresco dentro da janela, stale depois', () => {
    expect(deriveStale(1000, 1000 + STALE_MS - 1)).toBe(false);
    expect(deriveStale(1000, 1000 + STALE_MS + 1)).toBe(true);
  });
});

describe('readDflSnapshot', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'dfl-')); process.env.COCKPIT_DFL_POINTS = join(dir, 'dfl-points.json'); });
  afterEach(async () => { delete process.env.COCKPIT_DFL_POINTS; await rm(dir, { recursive: true, force: true }); });

  it('arquivo ausente = null (fail-closed)', async () => {
    expect(await readDflSnapshot()).toBeNull();
  });

  it('lê e re-deriva stale pelo now', async () => {
    const snap = foldDflTree(input(), 1_000_000);
    await writeFile(dflSnapshotFile(), JSON.stringify(snap), 'utf8');
    const fresh = await readDflSnapshot(1_000_000 + 1000);
    expect(fresh?.stale).toBe(false);
    const old = await readDflSnapshot(1_000_000 + STALE_MS + 1000);
    expect(old?.stale).toBe(true);
  });

  it('json corrompido = null', async () => {
    await writeFile(dflSnapshotFile(), '{ nope', 'utf8');
    expect(await readDflSnapshot()).toBeNull();
  });
});
