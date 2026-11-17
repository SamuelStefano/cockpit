import type { AgentLive, ToolCall, ToolTodo } from '../shared/protocol';
import { capHead, isSensitivePath, MASK, redactSecrets, SENSITIVE_FILE_NOTE } from './redact-secrets';
import { tildePath } from './tilde-path';

export const LIVE_DIFF_MAX = 4_000;
// Hard bound on what redaction scans; far above LIVE_DIFF_MAX so a secret cut
// here is always beyond the final cap anyway.
const LIVE_SCAN_MAX = 64 * 1024;
export const LIVE_COMMAND_MAX = 300;
export const LIVE_TAIL_LINES = 20;
export const LIVE_TAIL_LINE_MAX = 300;

// Last known activity per bot, derived from the tool events the turn already
// streams (ws/tools.ts). One entry per bot: no growth with run length.
const live = new Map<string, AgentLive>();

function stepOf(todos: ToolTodo[] | undefined): Pick<AgentLive, 'step' | 'stepIndex' | 'stepTotal'> {
  if (!todos?.length) return {};
  const i = todos.findIndex((t) => t.status === 'in_progress');
  if (i === -1) return { stepTotal: todos.length };
  const t = todos[i];
  return { step: redactSecrets(t.activeForm || t.content).slice(0, LIVE_COMMAND_MAX), stepIndex: i + 1, stepTotal: todos.length };
}

function diffText(old: string, next: string): string {
  const minus = old ? old.split('\n').map((l) => `- ${l}`) : [];
  const plus = next.split('\n').map((l) => `+ ${l}`);
  return [...minus, ...plus].join('\n');
}

// Pure: tool event -> redacted, capped live snapshot merged over the previous one.
export function liveFromTool(prev: AgentLive | undefined, tool: ToolCall, now = Date.now(), home?: string): AgentLive {
  const next: AgentLive = { ...(prev ?? {}), at: now, status: tool.status };
  if (tool.name && tool.name !== 'tool') {
    next.tool = tool.name;
    next.command = redactSecrets(tool.command || tool.label || '').slice(0, LIVE_COMMAND_MAX);
    delete next.file;
  }
  if (tool.todos) Object.assign(next, { step: undefined, stepIndex: undefined, stepTotal: undefined }, stepOf(tool.todos));
  if (tool.diff) {
    const path = tildePath(tool.diff.path, home);
    if (isSensitivePath(tool.diff.path, home)) {
      next.file = { path, diff: SENSITIVE_FILE_NOTE, truncated: false, hidden: true };
    } else {
      // Redact before the display cap: cutting first could split a key below the
      // length its pattern needs and let the prefix through.
      const raw = capHead(diffText(tool.diff.old, tool.diff.new), LIVE_SCAN_MAX);
      const red = capHead(redactSecrets(raw.text), LIVE_DIFF_MAX);
      next.file = { path, diff: red.truncated ? maskCutTail(red.text) : red.text, truncated: raw.truncated || red.truncated };
    }
  }
  return next;
}

// The cap may cut through a token; its visible head is too short for any rule.
export function maskCutTail(s: string): string {
  return s.replace(/[A-Za-z0-9_\-+/=.]{8,}$/, MASK);
}

// A key body line whose BEGIN and END both scrolled out of the window.
const BASE64_LINE = /^\s*(?=[A-Za-z0-9+/]*[a-z])(?=[A-Za-z0-9+/]*[A-Z])[A-Za-z0-9+/]{60,}={0,2}\s*$/;

// Redacts the joined window, not line by line: a PEM body spans many lines and
// only the whole text shows where it starts and ends.
export function terminalTail(lines: string[], max = LIVE_TAIL_LINES): string[] {
  const text = redactSecrets(lines.slice(-max).join('\n'));
  return text.split('\n').map((l) => (BASE64_LINE.test(l) ? MASK : l.length > LIVE_TAIL_LINE_MAX ? maskCutTail(l.slice(0, LIVE_TAIL_LINE_MAX)) : l));
}

export function recordLiveTool(botId: string, tool: ToolCall): void {
  live.set(botId, liveFromTool(live.get(botId), tool));
}

export function getLive(botId: string): AgentLive | undefined {
  return live.get(botId);
}

// The turn ended (close, error, abort): the panel must not show a dead run as live.
export function endLive(botId: string | undefined): void {
  if (botId) live.delete(botId);
}

export function clearLive(botId?: string): void {
  if (botId) live.delete(botId);
  else live.clear();
}
