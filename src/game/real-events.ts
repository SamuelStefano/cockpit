import type { ToolCall } from '../../shared/protocol';
import type { CanvasCard, CardStatus } from '../../shared/canvas';
import type { GameEvent } from './types';

// `--auto` only schedules the merge; the PR is not merged yet.
const MERGE_RE = /(^|[\s;&|(])gh\s+pr\s+merge\b/;
const NOT_A_MERGE_RE = /--auto\b|--disable-auto\b|--help\b|\s-h(\s|$)/;

// A finished `gh pr merge` the agent ran in a session. Pure: looks at one frame.
export function toolGameEvent(tool: ToolCall): GameEvent | null {
  if (tool.status !== 'done') return null;
  if (tool.exit !== undefined && tool.exit !== 0) return null;
  if (tool.name !== 'Bash' || !MERGE_RE.test(tool.command) || NOT_A_MERGE_RE.test(tool.command)) return null;
  return { type: 'pr_merged', key: tool.id };
}

export type CardStatusMap = Map<string, CardStatus>;

export const cardStatuses = (cards: readonly CanvasCard[]): CardStatusMap => new Map(cards.map((c) => [c.id, c.status]));

// Cards that moved INTO done since the previous snapshot. The first snapshot
// (prev === null) is a baseline: opening the Deck must not pay for old work.
export function newlyDone(prev: CardStatusMap | null, cards: readonly CanvasCard[]): CanvasCard[] {
  if (!prev) return [];
  return cards.filter((c) => c.status === 'done' && prev.has(c.id) && prev.get(c.id) !== 'done');
}
