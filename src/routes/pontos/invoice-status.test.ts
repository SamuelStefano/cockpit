import { describe, it, expect } from 'vitest';
import { invoiceStatus } from './invoice-status';

describe('invoiceStatus', () => {
  it('translates the DFL statuses and marks the in-flight ones orange', () => {
    expect(invoiceStatus('submitted')).toEqual({ label: 'em revisão', tone: 'orange' });
    expect(invoiceStatus('paid')).toEqual({ label: 'paga', tone: 'green' });
    expect(invoiceStatus('rejected').tone).toBe('red');
  });

  it('shows an unknown status as is', () => {
    expect(invoiceStatus('weird')).toEqual({ label: 'weird', tone: 'neutral' });
  });
});
