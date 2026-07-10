import { watch } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { pointsFile, readPoints } from './points';
import { broadcast } from './ws/broadcast';

const DEBOUNCE_MS = 150;
const RETRY_MS = 30_000;

// O agente appenda pontos no points.jsonl via CLI (fora do processo); este watcher
// vê a mudança e re-fold + broadcast pra TODOS os clientes — o app atualiza ao vivo
// em todos os aparelhos sem F5. Observa o diretório (o arquivo pode não existir
// ainda) e filtra pelo basename. Singleton (dois entrypoints: ws.ts e agent.ts).
let started = false;
export function startPointsWatch(hasClients: () => boolean) {
  if (started) return;
  started = true;
  const f = pointsFile();
  const dir = dirname(f);
  const base = basename(f);
  let timer: NodeJS.Timeout | null = null;

  const fire = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!hasClients()) return;
      readPoints().then(({ entries, total }) => broadcast({ t: 'points', entries, total })).catch(() => { /* best-effort */ });
    }, DEBOUNCE_MS);
    timer.unref?.();
  };

  const arm = () => {
    // ~/.cockpit pode não existir numa box virgem; cria antes de observar.
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
