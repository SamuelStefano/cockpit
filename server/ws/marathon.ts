import { readFileSync, writeFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Lane de maratona: uma sessão marcada aqui roda trabalho longo e desacompanhado
// (o prompt de 21h). Os tetos normais existem pra proteger o usuário de um turno
// desgovernado enquanto ele olha a tela; na maratona ninguém está olhando, e é o
// próprio comprimento que é o produto. Por isso só o teto de TEMPO DE VIDA cede —
// os de silêncio continuam valendo, porque um turno mudo está travado, não longo.

const STORE_PATH = process.env.COCKPIT_MARATHON ?? join(homedir(), '.cockpit', 'marathon.json');

// 72h em vez de sem limite: um loop que emite frame pra sempre passaria por baixo
// dos tetos de silêncio e queimaria token até alguém perceber.
export const MARATHON_TOTAL_CAP_MS = 72 * 60 * 60_000;

// A maratona atravessa deploy, OOM e queda de API — com teto 1 ela morreria na
// primeira e o trabalho da noite inteira se perderia.
export const MARATHON_AUTO_RESUME_CAP = 20;

// Cached by the file's mtime, not for the process lifetime: the index (loopback)
// and the agent are two processes on the same file. A plain cache made one
// backend's 72h cap ignore a session marked in the other, and a toggle rewrote
// the file from a stale set, erasing the other process's marks.
let keys: Set<string> | null = null;
let keysMtime = -1;

function load(): Set<string> {
  let mtime = -2;
  try { mtime = statSync(STORE_PATH).mtimeMs; } catch { /* no file yet */ }
  if (keys && mtime === keysMtime) return keys;
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    keys = new Set(Array.isArray(raw?.keys) ? raw.keys.filter((k: unknown) => typeof k === 'string') : []);
  } catch {
    keys = keys ?? new Set();
  }
  keysMtime = mtime;
  return keys;
}

export function isMarathon(sessionKey: string): boolean {
  return load().has(sessionKey);
}

export function marathonKeys(): string[] {
  return [...load()];
}

export function setMarathon(sessionKey: string, on: boolean): void {
  const set = load();
  if (on) set.add(sessionKey);
  else set.delete(sessionKey);
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    const tmp = `${STORE_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ keys: [...set] }, null, 2));
    renameSync(tmp, STORE_PATH);
    keysMtime = statSync(STORE_PATH).mtimeMs;
  } catch { /* disco cheio/readonly: a marca vale pra esta execução */ }
}

// O servidor nunca re-keyeia um thread: uma sessão nova roda a vida inteira como
// 'new-xxx' enquanto o sessionId real só aparece no primeiro frame. Marcar por uma
// das duas chaves e consultar pela outra é o caminho normal, não a exceção.
export function threadIsMarathon(sessionKey: string, sessionId?: string): boolean {
  return isMarathon(sessionKey) || (!!sessionId && isMarathon(sessionId));
}

export function __resetMarathonCache(): void {
  keys = null;
  keysMtime = -1;
}
