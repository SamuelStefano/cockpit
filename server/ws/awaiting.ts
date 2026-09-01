import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { withFileLock } from './file-lock';

// Sessões cujo último turno terminou em AskUserQuestion e aguardam a RESPOSTA do
// usuário. Vive fora de runs.ts/translate.ts pra evitar import circular (runs →
// translate → runs). O latch sobrevive ao fim do thread (threads.delete) — é ele
// que segura o flush automático de fila que chegaria antes da resposta e roubaria
// o card de escolha.
//
// Persistido em disco por dois motivos: o drainer varre de novo no boot do agente
// (um restart por deploy/OOM com latch só em memória reabria a janela do atropelo)
// e os handlers queue-* podem rodar no index por loopback, enquanto o drainer roda
// no agente. Lê o arquivo a cada chamada, como o parked.json: é a fonte de verdade
// compartilhada entre os processos, e um cache ficaria stale com a escrita do outro.
const AWAITING_PATH = process.env.COCKPIT_AWAITING ?? join(homedir(), '.cockpit', 'awaiting.json');

function load(): Set<string> {
  try {
    const o = JSON.parse(readFileSync(AWAITING_PATH, 'utf8'));
    return new Set(Array.isArray(o) ? o.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function save(keys: Set<string>): void {
  try {
    mkdirSync(dirname(AWAITING_PATH), { recursive: true });
    const tmp = `${AWAITING_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify([...keys]), 'utf8');
    renameSync(tmp, AWAITING_PATH);
  } catch { /* disco cheio/readonly: o latch em disco é hardening, não pode derrubar o turno */ }
}

export function isAwaiting(sessionKey: string): boolean {
  return load().has(sessionKey);
}

// Sob trava porque `load(); mutate; save()` roda nos DOIS processos (handlers no
// index por loopback, drainer no agente): sem ela as duas escritas partem da mesma
// versão e a segunda apaga a primeira. Perder um `setAwaiting` remove justamente o
// latch que segura o flush da fila — o atropelo que este módulo existe pra evitar.
export function setAwaiting(sessionKey: string): void {
  withFileLock(AWAITING_PATH, () => {
    const keys = load();
    if (keys.has(sessionKey)) return;
    keys.add(sessionKey);
    save(keys);
  });
}

export function clearAwaiting(sessionKey: string): void {
  withFileLock(AWAITING_PATH, () => {
    const keys = load();
    if (!keys.delete(sessionKey)) return;
    save(keys);
  });
}

export function clearAllAwaiting(): void {
  save(new Set());
}
