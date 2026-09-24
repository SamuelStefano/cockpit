// Pure logic for the sidebar chat composer: local send history (up-arrow
// recall). The wire format that lands a multi-line message in the
// orchestrator's tmux pane as ONE message lives in shared/canvas.ts
// (buildPastedSend) — the server's twin-process guard (runs.ts) uses the
// same function to write straight into the pane.

export const MAX_CHAT_HISTORY = 50;

export function pushChatHistory(history: string[], text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return history;
  // A repeat of the last entry doesn't need its own slot — up-arrow already
  // recalls it once.
  const next = history[history.length - 1] === trimmed ? history.slice(0, -1) : history;
  return [...next, trimmed].slice(-MAX_CHAT_HISTORY);
}

// index === history.length means "not browsing" (the live draft). ArrowUp
// walks backward toward 0 (oldest kept); ArrowDown walks forward and past the
// last entry back to the live draft.
export function stepChatHistory(historyLen: number, index: number, direction: 1 | -1): number {
  if (historyLen === 0) return historyLen;
  const next = index + direction;
  return Math.min(historyLen, Math.max(0, next));
}

export { buildPastedSend } from '../../../shared/canvas';
