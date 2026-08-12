import { watch } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { dflSnapshotFile, readDflSnapshot } from './dfl-points';
import { emitFinance, hasFinanceClients } from './ws/finance-clients';

const DEBOUNCE_MS = 150;
const RETRY_MS = 30_000;

// Observa ~/.cockpit/dfl-points.json: quando o cron/sync-now reescreve o arquivo
// (write atômico → um evento rename), re-lê e faz PUSH só pros sockets financeiros
// registrados (emitFinance) — nunca broadcast global. Singleton (ws.ts + agent.ts).
let started = false;
export function startDflPointsWatch(): void {
  if (started) return;
  started = true;
  const f = dflSnapshotFile();
  const dir = dirname(f);
  const base = basename(f);
  let timer: NodeJS.Timeout | null = null;

  const fire = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!hasFinanceClients()) return;
      readDflSnapshot().then((snap) => emitFinance(snap)).catch(() => { /* best-effort */ });
    }, DEBOUNCE_MS);
    timer.unref?.();
  };

  const arm = () => {
    mkdir(dir, { recursive: true }).catch(() => {}).finally(() => {
      try {
        const w = watch(dir, (_event, filename) => { if (!filename || filename === base) fire(); });
        w.on('error', () => {
          try { w.close(); } catch { /* já fechado */ }
          setTimeout(arm, RETRY_MS).unref();
        });
      } catch {
        setTimeout(arm, RETRY_MS).unref();
      }
    });
  };
  arm();
}
