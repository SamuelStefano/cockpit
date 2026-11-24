import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import type { BotComputer } from '../shared/protocol';
import { botTermId } from '../shared/bot-term';
import { botsRoot, botWorkspace, ensureWorkspace } from './engine/restricted-profile';
import { listBotFiles } from './team-files';
import { capturePane, safeTermCwd } from './terminals';

const LIST_CAP = 500;

// Where "Assumir" opens: the bot's workspace for every profile — the tab is the
// bot's, so a full bot does not hand out the whole HOME either. The workspace is
// created on demand (a bot that never ran has none) and resolved through its
// symlinks, so a workspace replaced by a link out of botsRoot() is refused.
export function botTermCwd(botId: string, root = botsRoot()): string | null {
  const ws = botWorkspace(botId);
  if (!ws || !safeTermCwd(ws, root) || !ensureWorkspace(ws)) return null;
  try {
    return safeTermCwd(realpathSync(ws), realpathSync(root)) ? ws : null;
  } catch { return null; }
}

export function tildePath(path: string, home = homedir()): string {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path;
}

export async function botComputer(botId: string): Promise<BotComputer | { error: string }> {
  const ws = botWorkspace(botId);
  if (!ws) return { error: 'bot inválido' };
  const files = await listBotFiles(botId);
  const list = 'error' in files ? [] : files;
  const termId = botTermId(botId);
  const pane = await capturePane(termId);
  return {
    cwd: tildePath(ws),
    files: list.length,
    bytes: list.reduce((n, f) => n + f.size, 0),
    truncated: list.length >= LIST_CAP,
    termId,
    termAlive: pane.alive,
    preview: pane.lines,
  };
}
