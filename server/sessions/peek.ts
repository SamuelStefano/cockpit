import type { Message } from '../../shared/protocol';
import type { SessionPeek } from '../../shared/canvas';
import { readRecords, recTs, sessionPath, type Rec } from './records';

export const PEEK_TAIL_CHARS = 600;
const MAX_LINKS = 12;
const URL_RE = /https?:\/\/[^\s<>()[\]{}"'`]+/g;
const PR_RE = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/;
const TRAILING_PUNCT_RE = /[.,;:!?*_~]+$/;

function assistantText(r: Rec): string {
  if (r.message?.role !== 'assistant' || !Array.isArray(r.message.content)) return '';
  return (r.message.content as { type?: string; text?: string }[])
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n')
    .trim();
}

export function extractUrls(text: string): string[] {
  return (text.match(URL_RE) ?? []).map((u) => u.replace(TRAILING_PUNCT_RE, ''));
}

// Keeps the END of a long message — the conclusion is what the drawer needs.
export function tailText(text: string, max = PEEK_TAIL_CHARS): string {
  return text.length <= max ? text : `…${text.slice(text.length - max + 1).trimStart()}`;
}

// Pure: file-order user/assistant records + the scan's pr-link markers in,
// drawer summary out. Links are read from assistant text only — tool output
// is full of URLs nobody meant to hand over.
export function peekFromRecords(msgs: Rec[], markers: Message[]): SessionPeek {
  let lastAssistant: string | undefined;
  let lastAt: number | undefined;
  const prs = new Map<string, string>();
  const links: string[] = [];
  const seen = new Set<string>();
  for (const m of markers) {
    if (m.role === 'compact' && m.kind === 'pr' && m.url) prs.set(m.url, m.label ?? m.url);
  }
  for (let i = msgs.length - 1; i >= 0; i--) {
    const text = assistantText(msgs[i]);
    if (!text) continue;
    if (lastAssistant === undefined) { lastAssistant = tailText(text); lastAt = recTs(msgs[i]); }
    for (const url of extractUrls(text).reverse()) {
      const pr = PR_RE.exec(url);
      if (pr) { if (!prs.has(url)) prs.set(url, `PR #${pr[2]} · ${pr[1]}`); continue; }
      if (seen.has(url) || links.length >= MAX_LINKS) continue;
      seen.add(url);
      links.push(url);
    }
  }
  return { lastAssistant, lastAt, prs: [...prs].map(([url, label]) => ({ url, label })), links };
}

export async function peekSession(sessionId: string): Promise<SessionPeek | null> {
  const path = sessionPath(sessionId);
  if (!path) return null;
  try {
    const scan = await readRecords(path);
    return peekFromRecords(scan.msgs, scan.markers);
  } catch {
    return null;
  }
}
