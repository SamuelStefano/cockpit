import type { TeamBot } from './protocol';
import type { TeamBotStatus } from './team-state';
import type { PrSummary, PrsSnapshot } from './prs';
import { redactText } from './diag';

export const TALK_MAX_TEXT = 4000;

export type TalkState = 'no-session' | TeamBotStatus;

export interface TalkPr { number: number; title: string; url: string; state: 'open' | 'merged'; blocker?: string }

export interface TalkSnapshot {
  redacted: false;
  botId: string;
  name: string;
  label: string;
  state: TalkState;
  task?: string;
  prs: TalkPr[];
  needs: string[];
  at: number;
}

export interface RedactedTalkSnapshot {
  redacted: true;
  botId: string;
  name: string;
  state: TalkState;
  openPrs: number;
  mergedPrs: number;
  needs: number;
  at: number;
}

export type TalkPayload = TalkSnapshot | RedactedTalkSnapshot;

export type TalkChunk =
  | { kind: 'delta'; text: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string }
  | { kind: 'refused'; reason: 'no-session' | 'empty' | 'too-long' | 'paused' | 'busy' };

export type TalkChunkPayload = TalkChunk | { kind: 'delta'; redacted: true; chars: number } | { kind: 'error'; redacted: true };

export interface TalkInfo { status?: TeamBotStatus; task?: string; prs: TalkPr[]; needs: string[] }

const tokens = (s: string): Set<string> => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

function prBlocker(pr: PrSummary): string | undefined {
  if (pr.state !== 'open') return undefined;
  if (pr.mergeable === 'conflict') return 'Merge conflict';
  if (pr.checks === 'failure') return 'Checks failing';
  if (pr.review === 'changes') return 'Changes requested';
  return undefined;
}

// Same ownership rule the bots use: the PR's session, then the bot id in the branch or title.
export function ownsPr(bot: Pick<TeamBot, 'id' | 'sessionId'>, pr: Pick<PrSummary, 'sessionId' | 'headRef' | 'title'>): boolean {
  if (bot.sessionId && pr.sessionId === bot.sessionId) return true;
  const id = bot.id.toLowerCase();
  return tokens(pr.headRef).has(id) || tokens(pr.title).has(id);
}

export function buildTalkInfo(
  bot: Pick<TeamBot, 'id' | 'sessionId'>,
  state: { status?: TeamBotStatus; task?: string } | undefined,
  prs: PrsSnapshot | null,
  pending: { botId: string; questions: { question: string }[] }[],
  now: number,
): TalkInfo {
  const since = now - 24 * 3_600_000;
  const mine = (prs?.mine ?? []).filter((p) => p.state === 'open' && ownsPr(bot, p));
  const merged = (prs?.merged ?? []).filter((p) => ownsPr(bot, p) && Date.parse(p.mergedAt ?? '') >= since);
  const slim = (p: PrSummary): TalkPr => {
    const blocker = prBlocker(p);
    return { number: p.number, title: p.title, url: p.url, state: p.state === 'merged' ? 'merged' : 'open', ...(blocker ? { blocker } : {}) };
  };
  const questions = pending.filter((q) => q.botId === bot.id).map((q) => q.questions[0]?.question ?? '').filter(Boolean);
  const needs = [...questions];
  if (state?.status === 'waiting' && questions.length === 0) needs.push('Waiting for an answer');
  for (const p of mine) { const b = prBlocker(p); if (b) needs.push(`${b}: ${p.repo}#${p.number} ${p.title}`); }
  return { status: state?.status, ...(state?.task ? { task: state.task } : {}), prs: [...mine, ...merged].map(slim), needs };
}

export function buildTalkSnapshot(bot: Pick<TeamBot, 'id' | 'name' | 'label' | 'sessionId'>, info: TalkInfo | undefined, now: number): TalkSnapshot {
  const state: TalkState = !bot.sessionId ? 'no-session' : info?.status ?? 'idle';
  return {
    redacted: false, botId: bot.id, name: bot.name, label: bot.label, state,
    ...(info?.task ? { task: info.task } : {}),
    prs: info?.prs ?? [],
    needs: info?.needs ?? [],
    at: now,
  };
}

export function redactTalkSnapshot(s: TalkSnapshot): RedactedTalkSnapshot {
  return {
    redacted: true, botId: s.botId, name: s.name, state: s.state,
    openPrs: s.prs.filter((p) => p.state === 'open').length, mergedPrs: s.prs.filter((p) => p.state === 'merged').length,
    needs: s.needs.length, at: s.at,
  };
}

// Secrets never leave the server in the snapshot, recording or not.
export function scrubTalkSnapshot(s: TalkSnapshot): TalkSnapshot {
  return {
    ...s,
    ...(s.task ? { task: redactText(s.task) } : {}),
    prs: s.prs.map((p) => ({ ...p, title: redactText(p.title) })),
    needs: s.needs.map(redactText),
  };
}

export const talkPayloadFor = (s: TalkSnapshot, recording: boolean): TalkPayload => (recording ? redactTalkSnapshot(s) : scrubTalkSnapshot(s));

export function redactChunk(c: TalkChunk): TalkChunkPayload {
  if (c.kind === 'delta') return { kind: 'delta', redacted: true, chars: c.text.length };
  if (c.kind === 'error') return { kind: 'error', redacted: true };
  return c;
}

const scrubChunk = (c: TalkChunk): TalkChunk => (c.kind === 'delta' ? { kind: 'delta', text: redactText(c.text) } : c.kind === 'error' ? { kind: 'error', message: redactText(c.message) } : c);

export const talkChunkFor = (c: TalkChunk, recording: boolean): TalkChunkPayload => (recording ? redactChunk(c) : scrubChunk(c));

// A secret can be split across two deltas, and neither half matches a redaction rule. The
// stream is released word by word: the unfinished last word waits for the next delta (or
// for the end of the turn) so the rules see it whole.
export const DELTA_HOLD_MAX = 200;

export function releaseDelta(tail: string, delta: string): { out: string; tail: string } {
  const raw = tail + delta;
  let cut = raw.search(/\S*$/);
  if (raw.length - cut > DELTA_HOLD_MAX) cut = raw.length - 64;
  return { out: redactText(raw.slice(0, cut)), tail: raw.slice(cut) };
}
