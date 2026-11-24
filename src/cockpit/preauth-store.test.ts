// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { ENROLL_TTL_MS } from '../../shared/e2e/enroll';
import { dropPreauth, pendingPreauths, savePreauth } from './preauth-store';

const a = new Uint8Array(16).fill(1), b = new Uint8Array(16).fill(2);

beforeEach(() => sessionStorage.clear());

describe('pending pre-authorization secrets', () => {
  it('keeps one secret per pair code, newest first, so two pairing screens do not clobber each other', () => {
    savePreauth('PAIR-1', a, 1000);
    savePreauth('PAIR-2', b, 2000);
    expect(pendingPreauths(2000)).toEqual([b, a]);
  });

  it('a new secret for the same pair code replaces the old one', () => {
    savePreauth('PAIR-1', a, 1000);
    savePreauth('PAIR-1', b, 1000);
    expect(pendingPreauths(1000)).toEqual([b]);
  });

  it('expires each secret with the box window (10 min), not later', () => {
    savePreauth('PAIR-1', a, 0);
    savePreauth('PAIR-2', b, 60_000);
    expect(pendingPreauths(ENROLL_TTL_MS)).toEqual([b]);
    expect(pendingPreauths(ENROLL_TTL_MS + 60_000)).toEqual([]);
  });

  it('drops only the redeemed secret', () => {
    savePreauth('PAIR-1', a, 0);
    savePreauth('PAIR-2', b, 0);
    dropPreauth(a, 0);
    expect(pendingPreauths(0)).toEqual([b]);
  });

  it('lives in sessionStorage, never in localStorage', () => {
    savePreauth('PAIR-1', a, Date.now());
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });
});
