import type { Message, ToolCall } from '../../data/types';

export type ActivityKind = 'file' | 'command' | 'read' | 'agent' | 'web' | 'tool' | 'talk';
export type ActivityFilter = 'all' | 'file' | 'command' | 'agent' | 'talk';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  verb: string;
  target: string;
  ts?: number;
  turn: number;
  status?: ToolCall['status'];
  tool?: ToolCall;
  text?: string;
}

export interface ActivitySummary { written: string[]; edited: string[]; commands: number; reads: number; agents: number; failed: number }

const FILE_VERBS: Record<string, string> = { Write: 'Wrote', Edit: 'Edited', MultiEdit: 'Edited', NotebookEdit: 'Edited' };
const READ_VERBS: Record<string, string> = { Read: 'Read', Grep: 'Searched', Glob: 'Listed' };
const WEB_VERBS: Record<string, string> = { WebFetch: 'Opened', WebSearch: 'Searched the web' };

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function toolItem(id: string, tool: ToolCall, turn: number, ts?: number): ActivityItem {
  const base = { id, ts, turn, tool, status: tool.status, target: tool.command };
  const n = tool.name;
  if (FILE_VERBS[n]) return { ...base, kind: 'file', verb: FILE_VERBS[n], target: tool.diff?.path ?? tool.command };
  if (n === 'Bash') return { ...base, kind: 'command', verb: 'Ran' };
  if (READ_VERBS[n]) return { ...base, kind: 'read', verb: READ_VERBS[n] };
  if (WEB_VERBS[n]) return { ...base, kind: 'web', verb: WEB_VERBS[n] };
  if (n === 'Agent' || n === 'Task') return { ...base, kind: 'agent', verb: `Started ${tool.label.replace(/^(Agent|Task)( · )?/, '') || 'an agent'}` };
  if (n === 'AskUserQuestion') return { ...base, kind: 'talk', verb: 'Asked you', target: tool.questions?.[0]?.question ?? '' };
  if (n === 'TaskCreate' || n === 'TaskUpdate') return { ...base, kind: 'tool', verb: 'Updated its task list' };
  if (n === 'TodoWrite') return { ...base, kind: 'tool', verb: 'Updated its task list', target: tool.todos?.find((t) => t.status === 'in_progress')?.content ?? '' };
  const mcp = /^mcp__(.+?)__(.+)$/.exec(n);
  return { ...base, kind: 'tool', verb: mcp ? `Used ${mcp[1]} · ${mcp[2]}` : `Used ${tool.label || n}` };
}

// Oldest first, one row per real thing the session did. Nothing here is inferred beyond the tool name.
export function activityOf(thread: Message[] | undefined): ActivityItem[] {
  const out: ActivityItem[] = [];
  // Rows before the first user message (history cut off above) stay in turn 0.
  let turn = 0;
  for (const m of thread ?? []) {
    if (m.role === 'user') { if (m.text.trim()) out.push({ id: m.id, kind: 'talk', verb: 'You said', target: '', ts: m.ts, text: m.text, turn: ++turn }); continue; }
    if (m.role === 'compact') { out.push({ id: m.id, kind: 'tool', verb: 'Context compacted', target: '', turn }); continue; }
    if (m.role !== 'assistant') continue;
    m.blocks.forEach((b, i) => {
      const id = `${m.id}-${i}`;
      if (b.type === 'tool') out.push(toolItem(b.tool.id || id, b.tool, turn, m.ts));
      else if (b.type === 'text' && b.md.trim()) out.push({ id, kind: 'talk', verb: 'Said', target: '', ts: m.ts, text: b.md, turn });
      else if (b.type === 'thinking' && b.text.trim()) out.push({ id, kind: 'talk', verb: 'Thought', target: '', ts: m.ts, text: b.text, turn });
      else if (b.type === 'code') out.push({ id, kind: 'talk', verb: `Showed ${b.lang || 'code'}`, target: '', ts: m.ts, text: b.code, turn });
    });
  }
  return out;
}

export function summaryOf(items: ActivityItem[]): ActivitySummary {
  const written = new Set<string>(), edited = new Set<string>();
  let commands = 0, reads = 0, agents = 0, failed = 0;
  for (const it of items) {
    if (it.status === 'error') failed++;
    if (it.kind === 'file' && it.status !== 'error' && it.target) (it.verb === 'Wrote' ? written : edited).add(it.target);
    if (it.kind === 'command') commands++;
    if (it.kind === 'read') reads++;
    if (it.kind === 'agent') agents++;
  }
  for (const f of written) edited.delete(f);
  return { written: [...written], edited: [...edited], commands, reads, agents, failed };
}

export function filterActivity(items: ActivityItem[], filter: ActivityFilter, failedOnly = false): ActivityItem[] {
  const byKind = filter === 'all' ? items : items.filter((it) => it.kind === filter);
  return failedOnly ? byKind.filter((it) => it.status === 'error') : byKind;
}

// Computed over the whole turn, before any filter or row cap, so the numbers never depend on the view.
export function turnSummaries(items: ActivityItem[]): Map<number, string> {
  const files = new Map<number, Set<string>>(), commands = new Map<number, number>(), agents = new Map<number, number>(), turns = new Set<number>();
  for (const it of items) {
    turns.add(it.turn);
    if (it.kind === 'file' && it.status !== 'error' && it.target) files.set(it.turn, (files.get(it.turn) ?? new Set()).add(it.target));
    if (it.kind === 'command') commands.set(it.turn, (commands.get(it.turn) ?? 0) + 1);
    if (it.kind === 'agent') agents.set(it.turn, (agents.get(it.turn) ?? 0) + 1);
  }
  const out = new Map<number, string>();
  for (const t of turns) {
    const parts = [t === 0 ? 'Earlier' : `Turn ${t}`];
    const f = files.get(t)?.size ?? 0, c = commands.get(t) ?? 0, a = agents.get(t) ?? 0;
    if (f) parts.push(plural(f, 'file'));
    if (c) parts.push(plural(c, 'command'));
    if (a) parts.push(plural(a, 'agent'));
    out.set(t, parts.join(' · '));
  }
  return out;
}

// Start of the turn in progress: the newest thing the user said.
export function lastUserTs(items: ActivityItem[]): number | undefined {
  for (let i = items.length - 1; i >= 0; i--) if (items[i].verb === 'You said' && items[i].kind === 'talk') return items[i].ts;
  return undefined;
}

export function newestTs(items: ActivityItem[]): number | undefined {
  let max: number | undefined;
  for (const it of items) if (it.ts !== undefined && (max === undefined || it.ts > max)) max = it.ts;
  return max;
}

// The sentence on the desk monitor: what the session is doing right now, when its thread is loaded.
export function latestAction(items: ActivityItem[]): string | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind !== 'talk') return `${it.verb} ${baseName(it.target)}`.trim();
  }
  return null;
}

export const baseName = (p: string) => (p.includes('\n') || p.includes(' ') ? p : p.split('/').pop() ?? p);
