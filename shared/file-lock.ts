import { mkdirSync, openSync, closeSync, statSync, fstatSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';

// Cross-process lock on `<target>.lock` (O_EXCL create). Lives in shared/ so the
// standalone CLIs (scripts/deck-drafts, run with Node's native type stripping,
// which only follows explicit `.ts` imports) take the SAME lock as the server.
// Only node builtins here for that reason. The server wraps it to log timeouts
// as incidents (server/ws/file-lock.ts).

// Dono do lock que morreu no meio (deploy, OOM) não pode travar o arquivo pra sempre.
export const LOCK_STALE_MS = 5_000;
export const SPINS = 100;
export const SPIN_MS = 5;

export function withFileLockSync<T>(target: string, fn: () => T, onTimeout?: (lockPath: string) => void): T {
  const lockPath = `${target}.lock`;
  mkdirSync(dirname(target), { recursive: true });
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  let fd: number | undefined;
  for (let i = 0; i < SPINS && fd === undefined; i++) {
    try {
      fd = openSync(lockPath, 'wx');
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) rmSync(lockPath, { force: true });
      } catch { /* outro processo liberou entre o stat e o rm */ }
      Atomics.wait(sleeper, 0, 0, SPIN_MS);
    }
  }
  // Sem o lock depois de ~500ms, segue mesmo assim: perder a corrida é raro, não
  // executar a operação seria perder o dado com certeza.
  if (fd === undefined) onTimeout?.(lockPath);
  // Identidade do lock que EU criei: se outro processo me declarou morto e recriou
  // o arquivo, o inode muda e o finally não pode apagar o lock DELE.
  const ino = fd === undefined ? undefined : fstatSync(fd).ino;
  try {
    return fn();
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
      try {
        if (statSync(lockPath).ino === ino) rmSync(lockPath, { force: true });
      } catch { /* já removido por reclaim de outro processo */ }
    }
  }
}
