import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, sep } from 'node:path';
import type { AgentSource, TeamBot } from '../shared/protocol';
import { validateAgentSource } from '../shared/agent-source';
import { botsRoot } from './engine/restricted-profile';
import { teamFile } from './team-log';

const BOT_ID_RE = /^[a-z0-9]{4,24}$/;

export function sourceCloneDir(botId: string): string | undefined {
  return BOT_ID_RE.test(botId) ? join(botsRoot(), botId, 'source') : undefined;
}

// The folder inside the clone, or undefined when it does not exist or escapes the
// clone once every symlink is resolved. Sync: run() is synchronous.
export function resolveAgentDir(botId: string, source: AgentSource): string | undefined {
  const clone = sourceCloneDir(botId);
  const v = validateAgentSource(source);
  if (!clone || !v.ok) return undefined;
  const dir = v.source.path ? join(clone, ...v.source.path.split('/')) : clone;
  if (!existsSync(dir)) return undefined;
  try {
    const root = realpathSync(clone);
    const real = realpathSync(dir);
    return real === root || real.startsWith(root + sep) ? real : undefined;
  } catch { return undefined; }
}

// cwd for a full-profile bot turn: its synced repo folder, read straight from
// team.json so resumes, the queue and crash recovery all land in the same place.
export function agentCwdSync(botId: string | undefined, file = teamFile()): string | undefined {
  if (!botId) return undefined;
  try {
    const team = JSON.parse(readFileSync(file, 'utf8')) as TeamBot[];
    const bot = Array.isArray(team) ? team.find((b) => b.id === botId) : undefined;
    return bot?.source ? resolveAgentDir(bot.id, bot.source) : undefined;
  } catch { return undefined; }
}
