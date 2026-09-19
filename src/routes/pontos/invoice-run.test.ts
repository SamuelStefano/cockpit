import { describe, it, expect, vi } from 'vitest';
import { runInvoiceBatch, invoiceKey, summarize, type CreateInvoice } from './invoice-run';
import type { InvoiceDraft } from './invoiceFromSelection';

const draft = (deliveryId: string, referenceMonth = '2026-09'): InvoiceDraft => ({
  deliveryId,
  deliveryName: `entrega ${deliveryId}`,
  projectId: 'p1',
  projectName: 'projeto',
  pricePerPoint: 75,
  referenceMonth,
  tasks: [{ id: 't1', title: 'task', points: 2 }],
  points: 2,
  amountCents: 15_000,
});

const ok: CreateInvoice = async () => ({ ok: true });

describe('invoiceKey', () => {
  it('separa a mesma delivery em meses diferentes', () => {
    expect(invoiceKey(draft('d1', '2026-09'))).not.toBe(invoiceKey(draft('d1', '2026-10')));
  });
});

describe('runInvoiceBatch', () => {
  it('cria uma fatura por delivery quando tudo dá certo', async () => {
    const create = vi.fn(ok);
    const r = await runInvoiceBatch([draft('d1'), draft('d2')], new Set(), create);
    expect(create).toHaveBeenCalledTimes(2);
    expect(summarize(r.results)).toEqual({ created: 2, skipped: 0, failed: 0 });
    expect(r.settled).toEqual([invoiceKey(draft('d1')), invoiceKey(draft('d2'))]);
    expect(r.failed).toEqual([]);
  });

  it('numa falha parcial só a delivery que falhou continua pendente', async () => {
    const create = vi.fn<CreateInvoice>(async (d) => (d.deliveryId === 'd2' ? { ok: false, message: 'boom' } : { ok: true }));
    const r = await runInvoiceBatch([draft('d1'), draft('d2'), draft('d3')], new Set(), create);
    expect(summarize(r.results)).toEqual({ created: 2, skipped: 0, failed: 1 });
    expect(r.settled).toEqual([invoiceKey(draft('d1')), invoiceKey(draft('d3'))]);
    expect(r.failed).toEqual([invoiceKey(draft('d2'))]);
    expect(r.results.find((x) => x.deliveryId === 'd2')).toMatchObject({ outcome: 'failed', message: 'boom' });
  });

  it('o segundo clique NÃO recria as faturas que já deram certo', async () => {
    const first = vi.fn<CreateInvoice>(async (d) => (d.deliveryId === 'd2' ? { ok: false } : { ok: true }));
    const drafts = [draft('d1'), draft('d2')];
    const a = await runInvoiceBatch(drafts, new Set(), first);

    const second = vi.fn(ok);
    const b = await runInvoiceBatch(drafts, new Set(a.settled), second);
    expect(second).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0][0].deliveryId).toBe('d2');
    expect(summarize(b.results)).toEqual({ created: 1, skipped: 1, failed: 0 });
  });

  it('a mesma delivery repetida no lote só é escrita uma vez', async () => {
    const create = vi.fn(ok);
    const r = await runInvoiceBatch([draft('d1'), draft('d1')], new Set(), create);
    expect(create).toHaveBeenCalledOnce();
    expect(summarize(r.results)).toEqual({ created: 1, skipped: 1, failed: 0 });
  });

  it('uma exceção conta como falha e mantém a delivery pendente', async () => {
    const create = vi.fn<CreateInvoice>(async () => { throw new Error('rede caiu'); });
    const r = await runInvoiceBatch([draft('d1')], new Set(), create);
    expect(r.settled).toEqual([]);
    expect(r.results[0]).toMatchObject({ outcome: 'failed', message: 'rede caiu' });
  });

  it('refaturar a mesma delivery noutro mês continua permitido', async () => {
    const create = vi.fn(ok);
    const done = new Set([invoiceKey(draft('d1', '2026-09'))]);
    const r = await runInvoiceBatch([draft('d1', '2026-10')], done, create);
    expect(create).toHaveBeenCalledOnce();
    expect(summarize(r.results)).toEqual({ created: 1, skipped: 0, failed: 0 });
  });
});
