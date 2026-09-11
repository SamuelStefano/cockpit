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

  it('flags at-risk when invoicing the open work would pass the cap', () => {
    const cap = monthCap([inv('2026-09', 'paid', 300_000)], 200_000, SEP_10_BRT);
    expect(cap.projectedCents).toBe(500_000);
    expect(cap.state).toBe('at-risk');
  });

  it('flags over when billed alone passes the cap', () => {
    const cap = monthCap([inv('2026-09', 'paid', 450_000)], 0, SEP_10_BRT);
    expect(cap.state).toBe('over');
    expect(cap.headroomCents).toBe(-50_000);
  });
});

describe('capDetail', () => {
  it('tells how much the open work would pass the cap', () => {
    const cap = monthCap([], 926_250, SEP_10_BRT);
    expect(capDetail(cap, brl)).toBe('Sobram R$ 4.000,00. Faturar todo o aberto (R$ 9.262,50) passa R$ 5.262,50 do teto.');
  });

  it('tells how much billed already passed the cap', () => {
    const cap = monthCap([inv('2026-09', 'paid', 502_500)], 0, SEP_10_BRT);
    expect(capDetail(cap, brl)).toContain('Passou R$ 1.025,00 do teto');
  });
});
