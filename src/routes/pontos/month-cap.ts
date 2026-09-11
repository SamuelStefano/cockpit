import type { DflInvoice } from '../../../shared/protocol';

// Agreed with the TL on 2026-09-04: monthly DFL invoices stay around R$ 4.000.
export const MONTHLY_CAP_CENTS = 400_000;

// A rejected or cancelled invoice never becomes money, so it cannot eat the cap.
const NOT_BILLED = new Set(['rejected', 'cancelled', 'canceled', 'void']);

export type MonthCapState = 'ok' | 'at-risk' | 'over';

export interface MonthCap {
  month: string;
  billedCents: number;
  openCents: number;
  capCents: number;
  headroomCents: number;
  projectedCents: number;
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
  const projectedCents = billedCents + open;
  const state: MonthCapState = billedCents > capCents ? 'over' : projectedCents > capCents ? 'at-risk' : 'ok';
  return { month, billedCents, openCents: open, capCents, headroomCents: capCents - billedCents, projectedCents, state };
}

export function capDetail(cap: MonthCap, brl: (cents: number) => string): string {
  if (cap.state === 'over') return `Passou ${brl(-cap.headroomCents)} do teto. Segure faturas novas ou combine exceção.`;
  if (cap.state === 'at-risk') {
    return `Sobram ${brl(cap.headroomCents)}. Faturar todo o aberto (${brl(cap.openCents)}) passa ${brl(cap.projectedCents - cap.capCents)} do teto.`;
  }
  return `Sobram ${brl(cap.capCents - cap.projectedCents)} mesmo faturando todo o aberto.`;
}
