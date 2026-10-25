import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TeamProfile } from '../../shared/protocol';
import { isAgentModel } from '../../shared/agents';

// Built-in tools a restricted bot turn gets at all (`--tools`): whatever is not
// listed does not exist in the session, subagents included.
export const RESTRICTED_TOOLS = ['AskUserQuestion', 'Edit', 'Glob', 'Grep', 'Read', 'TodoWrite', 'WebFetch', 'WebSearch', 'Write'];
// Redundant with `--tools`, on purpose: a CLI that stops honoring `--tools` for one
// of these still has the deny rule, and deny wins over every allow and every mode.
export const RESTRICTED_DENY = ['Agent', 'Bash', 'BashOutput', 'KillShell', 'Monitor', 'NotebookEdit', 'PowerShell', 'Task', 'Workflow'];

const BOT_ID_RE = /^[a-z0-9]{4,24}$/;
// `--allowedTools` is ONE space-separated argument: a space in the path would split
// the rule into a bare `Edit` that allows every path.
const SAFE_PATH_RE = /^\/[A-Za-z0-9._/-]+$/;
// The only project-dir names CLI 2.1.309 accepts in CLAUDE_CODE_PROJECT_DIR_NAME;
// anything else is silently ignored and the transcript lands in the workspace slug.
const PROJECT_DIR_NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function botsRoot(): string {
  return process.env.COCKPIT_BOTS_DIR ?? join(homedir(), '.cockpit', 'bots');
}

export function botWorkspace(botId: string | undefined): string | undefined {
  if (!botId || !BOT_ID_RE.test(botId)) return undefined;
  return join(botsRoot(), botId, 'workspace');
}

export interface RestrictedTurn {
  cwd: string;
  permissionMode: 'plan' | 'default';
  allow: string[];
  deny: string[];
  args: string[];
  env: Record<string, string>;
}

// What a restricted bot turn runs with. `mode` and `bypass` from the frame or the
// bot can only pick plan or default: auto/acceptEdits/bypass all land on default,
// where anything outside `allow` reaches the permission tool and is denied.
// The cwd moves to the bot's workspace, which `--restricted` makes the only place
// the file tools reach. The transcript must still land in the Deck's projects dir
// (history, `--resume`, session list all read it from there), so the project dir
// name is pinned by env instead of derived from the cwd.
export function restrictedTurn(o: { botId?: string; mode?: string }, projectDirName: string, home = process.env.HOME ?? homedir()): RestrictedTurn | { error: string } {
  const ws = botWorkspace(o.botId);
  if (!ws || !SAFE_PATH_RE.test(ws)) return { error: 'perfil travado: workspace do bot inválido' };
  if (!PROJECT_DIR_NAME_RE.test(projectDirName)) return { error: 'perfil travado: o diretório de trabalho do Deck não é compatível' };
  const plan = o.mode === 'plan';
  // `//` marks an absolute path in a permission rule; a single `/` is relative to the settings file.
  const root = `/${ws}/**`;
  return {
    cwd: ws,
    permissionMode: plan ? 'plan' : 'default',
    allow: plan ? [] : ['Glob', 'Grep', 'WebFetch', 'WebSearch', `Read(${root})`, `Edit(${root})`, `Write(${root})`],
    deny: RESTRICTED_DENY,
    args: ['--restricted', '--tools', RESTRICTED_TOOLS.join(' ')],
    env: {
      CLAUDE_CONFIG_DIR: join(home, '.claude'),
      CLAUDE_CODE_PROJECT_DIR_NAME: projectDirName,
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    },
  };
}

// ACP agents run their own tool loop, outside every rule above.
export function restrictedModelError(profile: TeamProfile | undefined, model: string | undefined): string | null {
  return profile === 'restricted' && isAgentModel(model) ? 'bot com perfil travado não pode usar agente externo' : null;
}

// What a restricted turn ignores, dropped before it reaches the thread: the stored
// params are what a resume, the queue and the tools panel read back.
export function stripRestricted<T extends { profile?: TeamProfile; mcps?: string[]; bypass?: boolean; allowWorkflow?: boolean }>(p: T): T {
  if (p.profile !== 'restricted') return p;
  const { mcps: _m, bypass: _b, allowWorkflow: _w, ...rest } = p;
  return rest as T;
}

export function ensureWorkspace(dir: string): boolean {
  try { mkdirSync(dir, { recursive: true, mode: 0o700 }); return true; } catch { return false; }
}
