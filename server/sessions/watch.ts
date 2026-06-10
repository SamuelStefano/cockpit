import { watch } from 'node:fs';
import { CONFIG } from '../config';
import { broadcast } from '../ws/broadcast';
import { listSessions } from './index';

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

export const TOUCH_DEBOUNCE_MS = 600;
export const LIST_DEBOUNCE_MS = 1500;
export const RETRY_MS = 30_000;

export function sessionIdFromFile(filename: unknown): string | null {
  if (typeof filename !== 'string') return null;
  return UUID_FILE.test(filename) ? filename.slice(0, -'.jsonl'.length) : null;
}

interface WatchHandlerOpts {
  hasClients: () => boolean;
  touch: (sessionId: string) => void;
  list: () => void;
  touchMs?: number;
  listMs?: number;
}

// Debounce em dois níveis: por sessão (trailing — só avisa quando a escrita do
// turno assenta) e global pra lista do sidebar (no máximo 1 broadcast por janela,
// mesmo com várias sessões escrevendo ao mesmo tempo).
export function createWatchHandler(opts: WatchHandlerOpts) {
  const timers = new Map<string, NodeJS.Timeout>();
  let listTimer: NodeJS.Timeout | null = null;
  return (filename: unknown) => {
    if (!opts.hasClients()) return;
    const id = sessionIdFromFile(filename);
    if (!id) return;
    const prev = timers.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => { timers.delete(id); opts.touch(id); }, opts.touchMs ?? TOUCH_DEBOUNCE_MS);
    t.unref?.();
    timers.set(id, t);
    if (!listTimer) {
      listTimer = setTimeout(() => {
        listTimer = null;
        if (opts.hasClients()) opts.list();
      }, opts.listMs ?? LIST_DEBOUNCE_MS);
      listTimer.unref?.();
    }
  };
}

// Atividade de fora do app (claude rodado direto no terminal escreve no mesmo
// JSONL) vira push pros clientes — sem isto a conversa só aparece no F5.
// Singleton: ws.ts (listen) e agent.ts (dial T3) são entrypoints distintos, mas
// se algum dia rodarem no mesmo processo, dois watchers dobrariam os broadcasts.
let started = false;
export function startSessionsWatch(hasClients: () => boolean) {
  if (started) return;
  started = true;
  const handler = createWatchHandler({
    hasClients,
    touch: (sessionId) => broadcast({ t: 'session-touched', sessionId }),
    list: () => { listSessions().then((items) => broadcast({ t: 'sessions', items })).catch(() => { /* best-effort */ }); },
  });
  const arm = () => {
    // projectsDir pode não existir ainda (VPS virgem, claude nunca rodou);
    // rearma até o primeiro turno criar o diretório.
    try {
      const w = watch(CONFIG.projectsDir, (_event, filename) => handler(filename));
      w.on('error', () => {
        try { w.close(); } catch { /* já fechado */ }
        setTimeout(arm, RETRY_MS).unref();
      });
    } catch {
      setTimeout(arm, RETRY_MS).unref();
    }
  };
  arm();
}
