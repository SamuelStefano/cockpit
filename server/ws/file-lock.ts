import { mkdirSync, openSync, closeSync, statSync, fstatSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { dirname } from 'node:path';
import { recordIncident } from './incidents';
import { LOCK_STALE_MS, SPINS, SPIN_MS, withFileLockSync } from '../../shared/file-lock';

// Exclusão mútua entre PROCESSOS pra um ciclo ler-modificar-escrever num arquivo de
// estado do ~/.cockpit. O Deck roda em dois processos que mexem nos mesmos arquivos
// (o agente e o index por loopback), e neles `load(); mutate; save()` não é atômico:
// os dois leem a mesma versão, os dois escrevem, e a segunda escrita apaga a
// primeira em silêncio. O que se perde é sempre estado que o usuário não vê sumir —
// um prompt da fila, o latch de uma pergunta, o registro de um turno vivo.
//
// Vive num módulo próprio porque os três arquivos precisam da MESMA trava; copiar
// esta função é o tipo de coisa que diverge (foi assim que parked.ts ficou com lock
// e os outros dois sem).
export function withFileLock<T>(target: string, fn: () => T): T {
  return withFileLockSync(target, fn, (lockPath) =>
    recordIncident({ kind: 'file-lock-timeout', sessionKey: '-', detail: `lock preso ha >${SPINS * SPIN_MS}ms em ${lockPath}` }));
}

// Same lock file and rules as withFileLock, for a read-modify-write that awaits
// (fs/promises). The sync version cannot hold across an await: it would release
// the lock the moment `fn` returned its promise. Waits with timers instead of
// Atomics.wait, so it never blocks the event loop.
export const ASYNC_WAIT_MS = LOCK_STALE_MS + 1_000;

export async function withFileLockAsync<T>(target: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${target}.lock`;
  mkdirSync(dirname(target), { recursive: true });
  let fd: number | undefined;
  // Waiting costs nothing here (timers, not Atomics.wait), so wait past the stale
  // threshold instead of the sync version's ~500 ms: a holder stalled for 0.5–5 s
  // (big JSON parse, GC, swap on this box) used to be written over unlocked —
  // the lost update #776 exists to prevent. By the deadline a dead holder's lock
  // has been reclaimed.
  const deadline = Date.now() + ASYNC_WAIT_MS;
  while (fd === undefined && Date.now() < deadline) {
    try {
      fd = openSync(lockPath, 'wx');
    } catch {
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) rmSync(lockPath, { force: true });
      } catch { /* released between stat and rm */ }
      await sleep(SPIN_MS);
    }
  }
  if (fd === undefined) recordIncident({ kind: 'file-lock-timeout', sessionKey: '-', detail: `lock preso ha >${ASYNC_WAIT_MS}ms em ${lockPath}` });
  const ino = fd === undefined ? undefined : fstatSync(fd).ino;
  try {
    return await fn();
  } finally {
    if (fd !== undefined) {
      closeSync(fd);
      try {
        if (statSync(lockPath).ino === ino) rmSync(lockPath, { force: true });
      } catch { /* already reclaimed */ }
    }
  }
}
