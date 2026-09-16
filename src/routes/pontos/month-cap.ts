import type { DflInvoice } from '../../../shared/protocol';

// REGRA 2 (Samuel, 16/09/2026): o teto mensal limita o que VIRA FATURA no mês,
// não o quanto de trabalho pode existir. Podem existir dezenas de épicos somando
// muito acima do teto — eles ficam em espera e entram num mês seguinte. Só é
// problema o que JÁ FOI FATURADO passar do teto que o Tainan definiu pro mês.
// Acordo de 2026-09-04: ~R$ 4.000/mês. O valor é editável por mês na UI porque
// quem define o teto de cada mês é o Tainan.
export const MONTHLY_CAP_CENTS = 400_000;

// Uma fatura rejeitada/cancelada nunca vira dinheiro, então não come o teto.
const NOT_BILLED = new Set(['rejected', 'cancelled', 'canceled', 'void']);

export type MonthCapState = 'ok' | 'full' | 'over';

export interface MonthCap {
  month: string;
  billedCents: number;       // já faturado no mês (conta contra o teto)
  openCents: number;         // recebível pronto pra faturar, de qualquer épico
  capCents: number;
  headroomCents: number;     // quanto ainda cabe faturar neste mês
  invoiceableCents: number;  // do aberto, quanto dá pra faturar agora
  waitingCents: number;      // do aberto, quanto espera um mês seguinte
  state: MonthCapState;
}

export function currentMonthKey(now: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now).slice(0, 7);
}

export function monthCap(invoices: DflInvoice[], openCents: number, now: number, capCents = MONTHLY_CAP_CENTS): MonthCap {
  const month = currentMonthKey(now);
  const billedCents = invoices
    .filter((inv) => inv.referenceMonth.startsWith(month) && !NOT_BILLED.has(inv.status))
    .reduce((sum, inv) => sum + inv.totalAmountCents, 0);
  const open = Math.max(0, openCents);
  const headroomCents = Math.max(0, capCents - billedCents);
  const invoiceableCents = Math.min(open, headroomCents);
  const state: MonthCapState = billedCents > capCents ? 'over' : headroomCents === 0 ? 'full' : 'ok';
  return {
    month, billedCents, openCents: open, capCents, headroomCents,
    invoiceableCents, waitingCents: open - invoiceableCents, state,
  };
}

export function capDetail(cap: MonthCap, brl: (cents: number) => string): string {
  if (cap.state === 'over') {
    return `Faturado ${brl(cap.billedCents - cap.capCents)} acima do teto. Combine a exceção com o Tainan ou segure o resto pro mês que vem.`;
  }
  if (cap.state === 'full') {
    return `Teto batido. ${brl(cap.waitingCents)} em aberto ficam em espera pro mês que vem — o trabalho continua registrado.`;
  }
  if (cap.waitingCents > 0) {
    return `Dá pra faturar ${brl(cap.invoiceableCents)} agora; ${brl(cap.waitingCents)} ficam em espera pro mês que vem.`;
  }
  return `Cabe todo o aberto (${brl(cap.openCents)}) e ainda sobram ${brl(cap.headroomCents - cap.openCents)} de teto.`;
}
