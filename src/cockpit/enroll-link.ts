import { parseEnrollCode, ENROLL_TTL_MS } from '../../shared/e2e/enroll';
import { isBoxId } from '../../shared/boxes';
import type { SealState } from './sealed-socket';

// Linking a new device from an enrolled one (QR): the enroll code rides in the
// URL fragment, which browsers never send to a server, so it reaches neither the
// relay nor any log. The page lifts it out of the address bar on load and keeps
// it in this tab only (sessionStorage, across a login) until used or expired.
// The code itself carries the agent fingerprint and a one-time secret, so the
// relay still cannot answer for the box.

export interface EnrollLink { code: string; box: string; expiresAt: number }

export const ENROLL_LINK_KEY = 'deck.enroll-link';

interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
interface Loc { pathname: string; search: string; hash: string }
interface Hist { replaceState(data: unknown, unused: string, url: string): void }

export function enrollLinkUrl(origin: string, link: EnrollLink): string {
  const p = new URLSearchParams({ enroll: link.code, box: link.box, exp: String(link.expiresAt) });
  return `${origin}/#${p.toString()}`;
}

function valid(code: unknown, box: unknown, exp: unknown, now: number): EnrollLink | null {
  if (typeof code !== 'string' || !isBoxId(box)) return null;
  try { parseEnrollCode(code); } catch { return null; }
  const n = typeof exp === 'number' ? exp : Number(exp);
  if (!Number.isFinite(n) || n <= 0) return null;
  // The expiry is a hint for a clear message; the box enforces the real one.
  return { code, box: box.toLowerCase(), expiresAt: Math.min(n, now + ENROLL_TTL_MS) };
}

export function hasEnrollHash(hash: string): boolean {
  return new URLSearchParams(hash.replace(/^#/, '')).has('enroll');
}

export function parseEnrollHash(hash: string, now = Date.now()): EnrollLink | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return valid(p.get('enroll'), p.get('box'), p.get('exp'), now);
}

// Strips the fragment from the address bar (and so from history) whatever it
// holds, a malformed code included, before anything else can read or keep it.
export function captureEnrollLink(loc: Loc, hist: Hist, store: KV, now = Date.now()): EnrollLink | null {
  if (!hasEnrollHash(loc.hash)) return null;
  const link = parseEnrollHash(loc.hash, now);
  hist.replaceState(null, '', loc.pathname + loc.search);
  if (link) {
    try { store.setItem(ENROLL_LINK_KEY, JSON.stringify(link)); } catch { /* memory-only below */ }
  }
  return link;
}

export function readEnrollLink(store: KV, now = Date.now()): EnrollLink | null {
  let raw: string | null = null;
  try { raw = store.getItem(ENROLL_LINK_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<EnrollLink>;
    const link = valid(o.code, o.box, o.expiresAt, now);
    if (!link) clearEnrollLink(store);
    return link;
  } catch { clearEnrollLink(store); return null; }
}

export function clearEnrollLink(store: KV): void {
  try { store.removeItem(ENROLL_LINK_KEY); } catch { /* nothing kept */ }
}

export type LinkStep = 'idle' | 'wait' | 'run' | 'done' | 'expired' | 'wrong-box';

export interface LinkContext { seal: SealState; active: string | null; boxes: string[] | null; now: number }

// Enrolls only on the box the code was minted for: the socket must be bound to
// it, and a box missing from this account's list is refused outright.
export function enrollLinkStep(link: EnrollLink | null, c: LinkContext): LinkStep {
  if (!link) return 'idle';
  if (c.now >= link.expiresAt) return 'expired';
  if (c.boxes && !c.boxes.includes(link.box)) return 'wrong-box';
  if (c.active !== link.box) return 'wait';
  if (c.seal === 'sealed') return 'done';
  return c.seal === 'enroll' || c.seal === 'rejected' ? 'run' : 'wait';
}

export interface MintedCode { code: string; expiresAt: number }

export function parseCodeFrame(m: Record<string, unknown>): MintedCode | null {
  if (m.t !== 'device-code' || typeof m.code !== 'string' || typeof m.expiresAt !== 'number') return null;
  return { code: m.code, expiresAt: m.expiresAt };
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
