import { watch } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { draftsFile, readDrafts } from './dfl-drafts';
import { emitFinanceMsg, hasFinanceClients } from './ws/finance-clients';

const DEBOUNCE_MS = 150;
const RETRY_MS = 30_000;

// The orchestrator stages epics through the `deck-drafts` CLI (another process).
// Watching the file is what makes them show up live on every open /pontos without
// F5. Pushed only to the owner's finance sockets (points + R$ context), never the
// global broadcast. Singleton: ws.ts and agent.ts both start it.
let started = false;
export function startDflDraftsWatch(): void {
  if (started) return;
  started = true;
  const f = draftsFile();
  const dir = dirname(f);
  const base = basename(f);
  let timer: NodeJS.Timeout | null = null;

  const fire = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!hasFinanceClients()) return;
      readDrafts().then((items) => emitFinanceMsg({ t: 'drafts', items })).catch(() => { /* best-effort */ });
    }, DEBOUNCE_MS);
    timer.unref?.();
  };

  const arm = () => {
    mkdir(dir, { recursive: true }).catch(() => {}).finally(() => {
      try {
        const w = watch(dir, (_event, filename) => { if (!filename || filename === base) fire(); });
        w.on('error', () => {
          try { w.close(); } catch { /* already closed */ }
          setTimeout(arm, RETRY_MS).unref();
        });
      } catch {
        setTimeout(arm, RETRY_MS).unref();
      }
    });
  };
  arm();
}
