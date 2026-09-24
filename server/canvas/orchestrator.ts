import { readFile } from 'node:fs/promises';
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
  return isOrchestratorInfo(raw) ? { name: raw.name, sessionId: raw.sessionId, tmux: raw.tmux } : undefined;
}
