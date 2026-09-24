import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { OrchestratorInfo } from '../../shared/canvas';

// Identity of the ONE canvas session that commands every other one — see
// shared/canvas.ts OrchestratorInfo. Lives outside the board/refs cache (it
// changes by hand, not by any canvas write path) so a stale board never
// carries a stale orchestrator pointer.
function orchestratorFile(): string {
  return process.env.COCKPIT_ORCHESTRATOR ?? join(homedir(), '.cockpit', 'orchestrator.json');
}

function isOrchestratorInfo(v: unknown): v is OrchestratorInfo {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.name === 'string' && !!r.name && typeof r.sessionId === 'string' && !!r.sessionId && typeof r.tmux === 'string' && !!r.tmux;
}

function parseOrchestrator(raw: unknown): OrchestratorInfo | undefined {
  return isOrchestratorInfo(raw) ? { name: raw.name, sessionId: raw.sessionId, tmux: raw.tmux } : undefined;
}

// Missing file, unreadable file, or a shape that doesn't match: no
// orchestrator — never thrown, since "nobody set one up yet" is the default
// state of a fresh Deck install, not an error worth surfacing on every
// canvas-graph build.
export async function readOrchestrator(): Promise<OrchestratorInfo | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(orchestratorFile(), 'utf8'));
  } catch {
    return undefined;
  }
  return parseOrchestrator(raw);
}

// Sync twin of readOrchestrator, for the twin-process guard in runs.ts
// startRun — that function stays synchronous (it's called from many places
// without an await, including fire-and-forget dispatch paths), and this file
// is a few bytes read from local disk, so a blocking read here is cheap
// against the alternative of threading async through every startRun caller.
export function readOrchestratorSync(): OrchestratorInfo | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(orchestratorFile(), 'utf8'));
  } catch {
    return undefined;
  }
  return parseOrchestrator(raw);
}

// Same tradeoff as readOrchestratorSync: `tmux has-session` answers in low
// single-digit ms against the local socket, so a blocking call here is far
// cheaper than making startRun's whole call chain async just for this check.
export function isTmuxAliveSync(name: string): boolean {
  try {
    // Blocks the event loop: a tmux wedged under load must not hang every run.
    // `=`: exact name; a bare `-t` also matches a longer session starting with it.
    execFileSync('tmux', ['has-session', '-t', `=${name}`], { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

const SHELLS = new Set(['bash', 'sh', 'zsh', 'fish', 'dash']);

// The Orchestrator's claude can die (crash, OOM kill, /exit) while its tmux
// session lives on with a bare shell in the pane. Pasting a prompt there runs
// every line as a shell command. Unknown (tmux error) counts as "not a shell" so
// delivery keeps its current behaviour.
export function paneRunsShellSync(name: string): boolean {
  try {
    const cmd = execFileSync('tmux', ['display-message', '-p', '-t', `=${name}:`, '#{pane_current_command}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 });
    return SHELLS.has(cmd.trim().replace(/^-/, ''));
  } catch {
    return false;
  }
}
