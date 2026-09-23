import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { applyDraftOp, sanitizeDrafts, type DflDraft, type DraftOp } from '../shared/dfl-drafts';

// Staged DFL epics ("Rascunhos para o DFL"). Whole-state JSON instead of the
// ledger's JSONL: a draft is edited freely until dispatched, there is no history
// worth keeping. Read per request so the `deck-drafts` CLI (another process) is
// always seen; written atomically (tmp + rename) so a concurrent reader never
// sees half a file. Path read at runtime so tests can point it elsewhere.
export function draftsFile(): string {
  return process.env.COCKPIT_DFL_DRAFTS ?? join(homedir(), '.cockpit', 'dfl-drafts.json');
}

export function newDraftId(prefix: 'ep' | 'tk' | 'dl'): string {
  return `${prefix}-${randomBytes(3).toString('hex')}`;
}

export async function readDrafts(): Promise<DflDraft[]> {
  try {
    return sanitizeDrafts(JSON.parse(await readFile(draftsFile(), 'utf8')));
  } catch {
    return [];
  }
}

async function writeDrafts(drafts: DflDraft[]): Promise<void> {
  const f = draftsFile();
  await mkdir(dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(drafts, null, 2) + '\n', 'utf8');
  await rename(tmp, f);
}

// Serialises this process's writes: two clicks in quick succession would
// otherwise both read the same state and the second write would drop the first.
let chain: Promise<unknown> = Promise.resolve();

export function mutateDrafts(op: DraftOp): Promise<DflDraft[]> {
  const run = chain.then(async () => {
    const next = applyDraftOp(await readDrafts(), op, { now: Date.now(), newId: newDraftId });
    await writeDrafts(next);
    return next;
  });
  chain = run.catch(() => {});
  return run;
}
