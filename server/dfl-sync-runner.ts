import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const pexec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));

// Dispara um sync sob demanda (botão "sincronizar agora"). Roda o dfl-sync como
// PROCESSO FILHO — o token NUNCA entra no processo do WS (só o filho autentica).
// O resultado chega à UI pelo watcher (arquivo reescrito → emitFinance). Coalesce:
// um sync em andamento ignora novos pedidos. Ver plano 20260722 (D5, invariante 4).
let running = false;

export function isDflSyncRunning(): boolean { return running; }

export async function runDflSync(): Promise<{ ok: boolean; error?: string }> {
  if (running) return { ok: true };
  running = true;
  try {
    const tsx = join(here, '..', 'node_modules', '.bin', 'tsx');
    const script = join(here, 'dfl-sync.ts');
    await pexec(tsx, [script], { timeout: 90_000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e) };
  } finally {
    running = false;
  }
}
