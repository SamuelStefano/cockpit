import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TeamPendingQuestion, ToolQuestion } from '../shared/protocol';
import { questionsOf } from './sessions/tool-views';
import { withFileLock } from './ws/file-lock';

export function teamPendingFile(): string {
  return process.env.COCKPIT_TEAM_PENDING ?? join(homedir(), '.cockpit', 'team-pending.json');
}

const ID_RE = /^[a-z0-9]{4,24}$/;

function coerce(raw: unknown): TeamPendingQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.botId !== 'string' || !ID_RE.test(o.botId) || typeof o.sessionKey !== 'string' || typeof o.at !== 'number') return null;
  const questions = questionsOf('AskUserQuestion', { questions: o.questions });
  return questions ? { botId: o.botId, sessionKey: o.sessionKey, questions, at: o.at } : null;
}

// Read on every call, like awaiting.json: the question is written by whichever
// process ran the turn (agent or index) and read by the other.
export function readPendingQuestions(): TeamPendingQuestion[] {
  try {
    const j = JSON.parse(readFileSync(teamPendingFile(), 'utf8'));
    return Array.isArray(j) ? j.map(coerce).filter((x): x is TeamPendingQuestion => !!x) : [];
  } catch {
    return [];
  }
}

function write(list: TeamPendingQuestion[]): void {
  const file = teamPendingFile();
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, JSON.stringify(list), 'utf8');
  renameSync(tmp, file);
}

// The questions an assistant message asks, if any: same parser the chat card uses.
export function questionsIn(content: unknown): ToolQuestion[] | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const c of content) {
    const qs = c?.type === 'tool_use' ? questionsOf(c.name, c.input) : undefined;
    if (qs?.length) return qs;
  }
  return undefined;
}

// One open question per bot: a newer one replaces the older.
export function setPendingQuestion(p: TeamPendingQuestion): TeamPendingQuestion[] {
  return withFileLock(teamPendingFile(), () => {
    const list = [...readPendingQuestions().filter((x) => x.botId !== p.botId), p];
    write(list);
    return list;
  });
}

// Null when the bot had no open question, so the caller broadcasts only on a change.
export function clearPendingQuestion(botId: string): TeamPendingQuestion[] | null {
  return withFileLock(teamPendingFile(), () => {
    const all = readPendingQuestions();
    const rest = all.filter((x) => x.botId !== botId);
    if (rest.length === all.length) return null;
    write(rest);
    return rest;
  });
}
