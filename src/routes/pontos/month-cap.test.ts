import { describe, expect, it } from 'vitest';
import type { DflInvoice } from '../../../shared/protocol';
import { brl } from './money';
import { capDetail, currentMonthKey, monthCap } from './month-cap';

const inv = (referenceMonth: string, status: string, totalAmountCents: number): DflInvoice => ({
  id: `${referenceMonth}-${status}-${totalAmountCents}`,
  referenceMonth,
  status,
  totalPoints: 0,
  totalAmountCents,
  items: [],
});

const SEP_10_BRT = Date.UTC(2026, 8, 10, 15);

describe('currentMonthKey', () => {
  it('uses Brasília, not UTC, at the month boundary', () => {
    expect(currentMonthKey(Date.UTC(2026, 9, 1, 1))).toBe('2026-09');
  });
});

describe('monthCap', () => {
  it('sums only current-month invoices and ignores rejected ones', () => {
    const cap = monthCap([
      inv('2026-09', 'paid', 150_000),
      inv('2026-09', 'rejected', 300_000),
      inv('2026-08', 'paid', 348_750),
    ], 0, SEP_10_BRT);
    expect(cap.billedCents).toBe(150_000);
    expect(cap.headroomCents).toBe(250_000);
    expect(cap.state).toBe('ok');
  });

  it('accepts reference months stored as full dates', () => {
    expect(monthCap([inv('2026-09-01', 'submitted', 45_000)], 0, SEP_10_BRT).billedCents).toBe(45_000);
  });

  // Regra 2: trabalho aberto acima do teto é normal — espera, não alarma.
  it('splits the open work into invoiceable now and waiting', () => {
    const cap = monthCap([inv('2026-09', 'paid', 300_000)], 200_000, SEP_10_BRT);
    expect(cap.headroomCents).toBe(100_000);
    expect(cap.invoiceableCents).toBe(100_000);
    expect(cap.waitingCents).toBe(100_000);
    expect(cap.state).toBe('ok');
  });

  it('is full, not over, when the cap is exactly reached', () => {
    const cap = monthCap([inv('2026-09', 'paid', 400_000)], 600_000, SEP_10_BRT);
    expect(cap.state).toBe('full');
    expect(cap.invoiceableCents).toBe(0);
    expect(cap.waitingCents).toBe(600_000);
  });

  it('flags over only when what was billed passes the cap', () => {
    const cap = monthCap([inv('2026-09', 'paid', 450_000)], 0, SEP_10_BRT);
    expect(cap.state).toBe('over');
    expect(cap.headroomCents).toBe(0);
  });

  it('takes the cap the TL set for that month', () => {
    const cap = monthCap([inv('2026-09', 'paid', 450_000)], 100_000, SEP_10_BRT, 600_000);
    expect(cap.state).toBe('ok');
    expect(cap.headroomCents).toBe(150_000);
    expect(cap.waitingCents).toBe(0);
  });
});

describe('capDetail', () => {
  it('says what can be invoiced now and what waits', () => {
    const cap = monthCap([], 926_250, SEP_10_BRT);
    expect(capDetail(cap, brl)).toBe('Dá pra faturar R$ 4.000,00 agora; R$ 5.262,50 ficam em espera pro mês que vem.');
  });

  it('tells how much billed already passed the cap', () => {
    const cap = monthCap([inv('2026-09', 'paid', 502_500)], 0, SEP_10_BRT);
    expect(capDetail(cap, brl)).toContain('R$ 1.025,00 acima do teto');
  });

  it('celebrates headroom left when everything open fits', () => {
    const cap = monthCap([], 100_000, SEP_10_BRT);
    expect(capDetail(cap, brl)).toContain('sobram R$ 3.000,00');
  });
});
