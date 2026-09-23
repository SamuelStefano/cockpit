import { CARD_MARKER_RE } from '../../shared/canvas';

// Shared by server/canvas/flows.ts and the kanban card-run path: a card's
// launch prompt (shared/canvas-prompt.ts buildTaskPrompt/buildContentPrompt)
// carries the `[deck-card:<id>]` marker only on the FIRST turn of the session
// it starts — every later turn in that same session has no marker of its
// own. This in-memory, process-lifetime map is the durable-enough answer to
// "which card is this session bound to", filled by bindCardSession whenever
// a caller discovers the binding (a marker match on turn close, or a
// refs-cache read) so it doesn't have to be rediscovered every time.

const bySession = new Map<string, string>();

export function bindCardSession(sessionId: string, cardId: string): void {
  bySession.set(sessionId, cardId);
}

export function cardIdForSession(sessionId: string): string | undefined {
  return bySession.get(sessionId);
}

// LAST match, not first: server/canvas/flows.ts builds follow-up prompts by
// prepending an UNTRUSTED model result ahead of its own trailing marker, and
// that result can itself contain an echoed `[deck-card:...]` substring (the
// model quoting an earlier turn, or a prompt-injection attempt). The first
// match in the string can be that echo; the marker a genuine launch or a
// flow delivery actually carries is always the last one.
export function lastCardMarker(prompt: string): string | undefined {
  let last: RegExpMatchArray | undefined;
  for (const m of prompt.matchAll(new RegExp(CARD_MARKER_RE.source, 'g'))) last = m;
  return last?.[1];
}

// A result/prompt segment that echoes literal marker syntax (model quoting
// earlier text, or an injection attempt) must never be mistakable for a REAL
// marker this module or server/canvas/flows.ts appends. Breaking the leading
// bracket is enough — every marker regex in this codebase requires it verbatim.
export function neutralizeMarkers(text: string): string {
  return text.split('[deck-flow:').join('(deck-flow:').split('[deck-card:').join('(deck-card:');
}

// Test-only: the map is module-level/process-lifetime, so a test suite that
// exercises bindCardSession needs a way to start clean.
export function __resetCardSessions(): void {
  bySession.clear();
}
