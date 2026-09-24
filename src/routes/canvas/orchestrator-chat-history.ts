// Pure logic for the sidebar chat composer: local send history (up-arrow
// recall) and the wire format that lands a multi-line message in the
// orchestrator's tmux pane as ONE message instead of one Enter per line.

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

// Bracketed paste (CSI 200~ ... CSI 201~) tells the pty's reader (readline in
// Claude Code CLI) that everything in between is one paste, not keystrokes —
// so embedded newlines don't submit early. The trailing \r is a real Enter,
// sent once the paste block closes, to submit the whole message.
export function buildPastedSend(text: string): string {
  return `\x1b[200~${text}\x1b[201~\r`;
}
