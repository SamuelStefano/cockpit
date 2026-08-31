import { mkdirSync, openSync, closeSync, statSync, fstatSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { recordIncident } from './incidents';

// Dono do lock que morreu no meio (deploy, OOM) não pode travar o arquivo pra sempre.
const LOCK_STALE_MS = 5_000;
const SPINS = 100;
const SPIN_MS = 5;

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
  // executar a operação seria perder o dado com certeza. Mas segue REGISTRADO — é a
  // única janela em que ainda dá pra perder uma escrita, e ela não pode voltar a ser
  // silenciosa como era o bug original.
  if (fd === undefined) recordIncident({ kind: 'file-lock-timeout', sessionKey: '-', detail: `lock preso ha >${SPINS * SPIN_MS}ms em ${lockPath}` });
  // Identidade do lock que EU criei. Se outro processo tiver me declarado morto e
  // recriado o arquivo, o inode muda — e apagar às cegas no finally derrubaria o
  // lock DELE, deixando um terceiro entrar enquanto ele escreve.
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
