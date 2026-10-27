import { captureEnrollLink } from './enroll-link';
import { boxStore } from './boxes-store';

// Imported first in main.tsx: the fragment leaves the address bar before the
// router, the auth client or anything else reads location. The link's box
// becomes this device's box, so the socket dials the one the code was made for.

const memory = new Map<string, string>();
const memoryStore = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v); },
  removeItem: (k: string) => { memory.delete(k); },
};

// A browser that blocks sessionStorage still keeps the link for this page load.
export function linkStore() {
  try { return window.sessionStorage ?? memoryStore; } catch { return memoryStore; }
}

if (typeof window !== 'undefined') {
  const link = captureEnrollLink(window.location, window.history, linkStore());
  if (link) boxStore.setPref(link.box);
}
