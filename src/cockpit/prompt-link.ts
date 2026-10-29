export const PROMPT_LINK_MAX = 8000;
export const PROMPT_LINK_PATH = '/novo';
const PENDING_KEY = 'deck.pendingPrompt';

// Zero-width, bidi controls and Unicode tag characters can smuggle instructions
// the user cannot see in the composer.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}]/gu;

export interface ParsedPromptLink {
  prompt: string;
  truncated: boolean;
  hadInvisible: boolean;
}

export function sanitizePrompt(raw: string): ParsedPromptLink {
  const clean = raw.replace(INVISIBLE, '');
  const hadInvisible = clean.length !== raw.length;
  const chars = Array.from(clean);
  const truncated = chars.length > PROMPT_LINK_MAX;
  return { prompt: truncated ? chars.slice(0, PROMPT_LINK_MAX).join('') : clean, truncated, hadInvisible };
}

// Accepts a full URL or a bare `?query`; only `/novo` and `/` carry a prompt.
export function parsePromptLink(input: string): ParsedPromptLink | null {
  let url: URL;
  try { url = new URL(input, 'http://deck.local'); } catch { return null; }
  if (url.pathname !== PROMPT_LINK_PATH && url.pathname !== '/') return null;
  const raw = url.searchParams.get('prompt');
  if (raw === null) return null;
  const parsed = sanitizePrompt(raw);
  return parsed.prompt.trim() ? parsed : null;
}

export function buildPromptLink(origin: string, draft: string): string {
  return `${origin}${PROMPT_LINK_PATH}?prompt=${encodeURIComponent(draft)}`;
}

// The auth/pairing gate can reload or redirect before the cockpit is ready, so
// the raw prompt waits in sessionStorage and the URL is cleaned right away.
export function capturePromptFromLocation(): void {
  try {
    if (!parsePromptLink(location.pathname + location.search)) return;
    const raw = new URLSearchParams(location.search).get('prompt') ?? '';
    sessionStorage.setItem(PENDING_KEY, raw);
    history.replaceState(null, '', '/');
  } catch { /* storage blocked: the link is simply ignored */ }
}

export function takePendingPrompt(): ParsedPromptLink | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(PENDING_KEY);
    const parsed = sanitizePrompt(raw);
    return parsed.prompt.trim() ? parsed : null;
  } catch { return null; }
}
