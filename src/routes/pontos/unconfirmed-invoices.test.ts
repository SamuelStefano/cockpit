// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { markUnconfirmed, unconfirmedKeys, releaseUnconfirmed, UNCONFIRMED_TTL_MS } from './unconfirmed-invoices';

beforeEach(() => localStorage.clear());

describe('unconfirmed invoices', () => {
  it('holds a key until released', () => {
    markUnconfirmed(['d1@2026-08'], 1000);
    expect(unconfirmedKeys(2000).has('d1@2026-08')).toBe(true);
    releaseUnconfirmed('d1@2026-08');
    expect(unconfirmedKeys(2000).size).toBe(0);
  });

  it('expires after the TTL', () => {
    markUnconfirmed(['d1@2026-08'], 1000);
    expect(unconfirmedKeys(1000 + UNCONFIRMED_TTL_MS).size).toBe(0);
  });

  it('survives garbage in storage', () => {
    localStorage.setItem('deck:pontos:unconfirmedInvoices', 'nope');
    expect(unconfirmedKeys(0).size).toBe(0);
  });
});
