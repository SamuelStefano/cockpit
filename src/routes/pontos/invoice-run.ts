import type { InvoiceDraft } from './invoiceFromSelection';

// Geração de fatura no DFL PROD, uma por delivery. O laço original não guardava
// nada: numa falha parcial (3 deliveries, a 2ª falha) as 2 que deram certo já
// existiam no DFL, a seleção continuava inteira e o segundo clique recriava as
// duas — fatura duplicada em produção financeira. Aqui cada delivery tem uma
// chave e só roda uma vez por chave.

export type InvoiceOutcome = 'created' | 'skipped' | 'failed';

export interface InvoiceResult {
  key: string;
  deliveryId: string;
  deliveryName: string;
  outcome: InvoiceOutcome;
  message?: string;
}

export interface InvoiceBatch {
  results: InvoiceResult[];
  // Deliveries que já existem no DFL depois desta passada (criadas agora ou antes).
  // É o conjunto que sai da seleção e que barra a próxima tentativa.
  settled: string[];
  failed: string[];
}

// A chave inclui o mês de referência: refaturar a MESMA delivery noutro mês é
// legítimo, repetir o mesmo mês é a duplicata que o bug produzia.
export function invoiceKey(d: Pick<InvoiceDraft, 'deliveryId' | 'referenceMonth'>): string {
  return `${d.deliveryId}@${d.referenceMonth}`;
}

export type CreateInvoice = (d: InvoiceDraft) => Promise<{ ok: boolean; message?: string }>;

// Sequencial de propósito: escrita financeira em paralelo esconde qual delivery
// falhou e multiplica o estrago de um erro transitório do endpoint.
export async function runInvoiceBatch(
  drafts: InvoiceDraft[],
  alreadyCreated: ReadonlySet<string>,
  create: CreateInvoice,
): Promise<InvoiceBatch> {
  const results: InvoiceResult[] = [];
  const settled: string[] = [];
  const failed: string[] = [];
  for (const d of drafts) {
    const key = invoiceKey(d);
    const base = { key, deliveryId: d.deliveryId, deliveryName: d.deliveryName };
    // Retry depois de uma falha parcial: quem já foi criado NÃO é chamado de novo.
    if (alreadyCreated.has(key) || settled.includes(key)) {
      results.push({ ...base, outcome: 'skipped' });
      settled.push(key);
      continue;
    }
    let r: { ok: boolean; message?: string };
    try {
      r = await create(d);
    } catch (e) {
      // Uma exceção (rede caiu, timeout) não diz se a fatura foi escrita ou não.
      // Tratar como falha mantém a delivery na seleção, e o retry é barrado só
      // pelo que o servidor confirmou como criado — nunca por um palpite.
      r = { ok: false, message: e instanceof Error ? e.message : 'falha inesperada' };
    }
    if (r.ok) {
      results.push({ ...base, outcome: 'created' });
      settled.push(key);
    } else {
      results.push({ ...base, outcome: 'failed', message: r.message ?? 'erro' });
      failed.push(key);
    }
  }
  return { results, settled, failed };
}

// Resumo pro toast. Separado do laço porque a contagem é a única coisa que o
// usuário lê quando dá tudo certo, e o detalhe por delivery aparece na lista.
export function summarize(results: InvoiceResult[]): { created: number; skipped: number; failed: number } {
  return {
    created: results.filter((r) => r.outcome === 'created').length,
    skipped: results.filter((r) => r.outcome === 'skipped').length,
    failed: results.filter((r) => r.outcome === 'failed').length,
  };
}
