// The canvas prompt bar's server round-trip (useCockpit.onSendTo) tracks its
// own in-flight sends so a LATER rejection can restore the text into the
// right window. The tricky part: server-side resolveThreadKey (dispatch.ts
// 'send') can triage a canvas send onto a DIFFERENT live thread key than the
// sessionId it was sent to (a cron run, a flow's own key) — the 'triage'
// frame (which carries both msgId and the REAL routed sessionKey) is the
// only place the client learns that real key. This pure function does the
// aliasing: after it runs, an error arriving under EITHER key finds the
// pending entry, and the entry still remembers which window's sessionId to
// restore into (canvas review #593 second pass item 2).
export interface PendingCanvasSend { msgId: string; text: string; sessionId: string }

export function aliasRoutedKey(
  pending: Map<string, PendingCanvasSend>,
  msgIdIndex: Map<string, string>,
  msgId: string,
  routedKey: string,
): void {
  const sessionId = msgIdIndex.get(msgId);
  if (!sessionId || sessionId === routedKey) return;
  const entry = pending.get(sessionId);
  if (entry) pending.set(routedKey, entry);
}
