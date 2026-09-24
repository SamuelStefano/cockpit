import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { scanSession } from '../ws/bg-agents';
import { listTerms } from '../terminals';
import type { DelegatedShell, OrchestratorActivity, OrchestratorInfo } from '../../shared/canvas';

// Dir the Orchestrator itself writes to by hand when it delegates work into a
// tmux shell it isn't sitting in — one task, two files: `<name>.prompt.md`
// (written before the shell starts) and `<name>.report.md` (written once the
// delegate is done). Only `.prompt.md` present = still running.
function orchShellsDir(): string {
  return process.env.COCKPIT_ORCH_SHELLS_DIR ?? join(homedir(), '.cockpit', 'orch-shells');
}

const PREVIEW_LEN = 140;

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim().length > 0) ?? '';
  return line.trim().slice(0, PREVIEW_LEN);
}

// Pure grouping: from a flat file listing + the set of currently-live tmux
// shell ids, to one row per delegated task. Testable without touching disk.
export function groupDelegatedShells(
  files: string[],
  liveShellIds: Set<string>,
  readPromptPreview: (name: string) => string | undefined,
  readReportPreview: (name: string) => string | undefined,
  readStartedAt: (name: string) => number | undefined = () => undefined,
): DelegatedShell[] {
  const names = new Set<string>();
  for (const f of files) {
    if (f.endsWith('.prompt.md')) names.add(f.slice(0, -'.prompt.md'.length));
    else if (f.endsWith('.report.md')) names.add(f.slice(0, -'.report.md'.length));
  }
  const out: DelegatedShell[] = [];
  for (const name of names) {
    const hasReport = files.includes(`${name}.report.md`);
    out.push({
      name,
      status: hasReport ? 'reported' : 'running',
      promptPreview: readPromptPreview(name),
      reportPreview: hasReport ? readReportPreview(name) : undefined,
      tmuxAlive: liveShellIds.has(`cv-${name}`),
      startedAt: readStartedAt(name),
    });
  }
  // Running first (the thing worth watching), then alphabetical within each group.
  return out.sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'running' ? -1 : 1));
}

async function readDelegatedShells(liveShellIds: Set<string>): Promise<DelegatedShell[]> {
  const dir = orchShellsDir();
  const files = await readdir(dir).catch(() => [] as string[]);
  const cache = new Map<string, string>();
  const mtimes = new Map<string, number>();
  // groupDelegatedShells wants sync readers (keeps it pure/testable); read
  // every candidate file's preview + the prompt file's mtime up front.
  await Promise.all(files.filter((f) => f.endsWith('.md')).map(async (f) => {
    const [text, st] = await Promise.all([
      readFile(join(dir, f), 'utf8').catch(() => ''),
      stat(join(dir, f)).catch(() => null),
    ]);
    cache.set(f, firstLine(text));
    if (st) mtimes.set(f, st.mtimeMs);
  }));
  return groupDelegatedShells(
    files, liveShellIds,
    (name) => cache.get(`${name}.prompt.md`),
    (name) => cache.get(`${name}.report.md`),
    (name) => mtimes.get(`${name}.prompt.md`),
  );
}

// Other `cockpit-cv-*` tmux sessions besides the Orchestrator's own AND not
// already accounted for by a delegated-shell file — a raw shell someone
// opened by hand from the canvas, with no prompt/report on record.
export function otherRawShells(liveShellIds: string[], selfTermId: string, delegated: DelegatedShell[]): string[] {
  const accounted = new Set(delegated.map((d) => `cv-${d.name}`));
  return liveShellIds.filter((id) => id.startsWith('cv-') && id !== selfTermId && !accounted.has(id));
}

// Cheap, incremental: BgAgent scanning reads only the small per-agent
// .output tail files (server/ws/bg-agents.ts), delegated-shell files are a
// handful of short markdown notes, and listTerms() is a single `tmux ls`.
// Nothing here rescans a whole transcript.
export async function readOrchestratorActivity(orchestrator: OrchestratorInfo, now = Date.now()): Promise<OrchestratorActivity> {
  const subagents = scanSession(orchestrator.sessionId, now);
  const live = await listTerms();
  const liveSet = new Set(live);
  const delegatedShells = await readDelegatedShells(liveSet);
  const selfTermId = orchestrator.tmux.replace(/^cockpit-/, '');
  const rawShells = otherRawShells(live, selfTermId, delegatedShells);
  return { subagents, delegatedShells, rawShells };
}
