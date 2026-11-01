import type { Message, ToolCall } from '../../data/types';

export type ActivityKind = 'file' | 'command' | 'read' | 'agent' | 'web' | 'tool' | 'talk';
export type ActivityFilter = 'all' | 'file' | 'command' | 'agent' | 'talk';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  verb: string;
  target: string;
  ts?: number;
  status?: ToolCall['status'];
  tool?: ToolCall;
  text?: string;
}

export interface ActivitySummary { written: string[]; edited: string[]; commands: number; reads: number; agents: number; failed: number }

const FILE_VERBS: Record<string, string> = { Write: 'Wrote', Edit: 'Edited', MultiEdit: 'Edited', NotebookEdit: 'Edited' };
const READ_VERBS: Record<string, string> = { Read: 'Read', Grep: 'Searched', Glob: 'Listed' };
const WEB_VERBS: Record<string, string> = { WebFetch: 'Opened', WebSearch: 'Searched the web' };

function toolItem(id: string, tool: ToolCall, ts?: number): ActivityItem {
  const base = { id, ts, tool, status: tool.status, target: tool.command };
  const n = tool.name;
  if (FILE_VERBS[n]) return { ...base, kind: 'file', verb: FILE_VERBS[n], target: tool.diff?.path ?? tool.command };
  if (n === 'Bash') return { ...base, kind: 'command', verb: 'Ran' };
  if (READ_VERBS[n]) return { ...base, kind: 'read', verb: READ_VERBS[n] };
  if (WEB_VERBS[n]) return { ...base, kind: 'web', verb: WEB_VERBS[n] };
  if (n === 'Agent' || n === 'Task') return { ...base, kind: 'agent', verb: `Started ${tool.label.replace(/^(Agent|Task)( · )?/, '') || 'an agent'}` };
  if (n === 'AskUserQuestion') return { ...base, kind: 'talk', verb: 'Asked you', target: tool.questions?.[0]?.question ?? '' };
  if (n === 'TodoWrite') return { ...base, kind: 'tool', verb: 'Updated its task list', target: tool.todos?.find((t) => t.status === 'in_progress')?.content ?? '' };
  const mcp = /^mcp__(.+?)__(.+)$/.exec(n);
  return { ...base, kind: 'tool', verb: mcp ? `Used ${mcp[1]} · ${mcp[2]}` : `Used ${tool.label || n}` };
}

// Oldest first, one row per real thing the session did. Nothing here is inferred beyond the tool name.
export function activityOf(thread: Message[] | undefined): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const m of thread ?? []) {
    if (m.role === 'user') { if (m.text.trim()) out.push({ id: m.id, kind: 'talk', verb: 'You said', target: '', ts: m.ts, text: m.text }); continue; }
    if (m.role === 'compact') { out.push({ id: m.id, kind: 'tool', verb: 'Context compacted', target: '' }); continue; }
    if (m.role !== 'assistant') continue;
    m.blocks.forEach((b, i) => {
      const id = `${m.id}-${i}`;
      if (b.type === 'tool') out.push(toolItem(b.tool.id || id, b.tool, m.ts));
      else if (b.type === 'text' && b.md.trim()) out.push({ id, kind: 'talk', verb: 'Said', target: '', ts: m.ts, text: b.md });
      else if (b.type === 'thinking' && b.text.trim()) out.push({ id, kind: 'talk', verb: 'Thought', target: '', ts: m.ts, text: b.text });
      else if (b.type === 'code') out.push({ id, kind: 'talk', verb: `Showed ${b.lang || 'code'}`, target: '', ts: m.ts, text: b.code });
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

export function filterActivity(items: ActivityItem[], filter: ActivityFilter): ActivityItem[] {
  return filter === 'all' ? items : items.filter((it) => it.kind === filter);
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
