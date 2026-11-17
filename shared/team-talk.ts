import type { TeamBot } from './protocol';
import type { TeamBotStatus } from './team-state';
import type { TeamPanelBot } from './team-panel';

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
  | { kind: 'refused'; reason: 'no-session' | 'empty' | 'too-long' };

export type TalkChunkPayload = TalkChunk | { kind: 'delta'; redacted: true; chars: number } | { kind: 'error'; redacted: true };

export function buildTalkSnapshot(bot: Pick<TeamBot, 'id' | 'name' | 'label' | 'sessionId'>, panel: TeamPanelBot | undefined, now: number): TalkSnapshot {
  const state: TalkState = !bot.sessionId ? 'no-session' : panel?.status ?? 'idle';
  return {
    redacted: false, botId: bot.id, name: bot.name, label: bot.label, state,
    ...(panel?.task ? { task: panel.task } : {}),
    prs: [...(panel?.openPrs ?? []), ...(panel?.mergedPrs ?? [])].map((p) => ({
      number: p.number, title: p.title, url: p.url, state: p.state, ...(p.blocker ? { blocker: p.blocker } : {}),
    })),
    needs: (panel?.needs ?? []).map((n) => n.text),
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

export const talkPayloadFor = (s: TalkSnapshot, recording: boolean): TalkPayload => (recording ? redactTalkSnapshot(s) : s);

export function redactChunk(c: TalkChunk): TalkChunkPayload {
  if (c.kind === 'delta') return { kind: 'delta', redacted: true, chars: c.text.length };
  if (c.kind === 'error') return { kind: 'error', redacted: true };
  return c;
}

export const talkChunkFor = (c: TalkChunk, recording: boolean): TalkChunkPayload => (recording ? redactChunk(c) : c);
