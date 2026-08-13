import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// Cascata por sessão: cada chat escolhe se quer a tentativa barata primeiro. Antes
// era um toggle global (`config.cascade`) — ligar numa maratona deixava TODO prompt
// de TODO chat, inclusive complexos, passando pelo modelo barato até alguém lembrar
// de desligar. Escopado por sessionKey, exatamente como a maratona (marathon.ts).

const STORE_PATH = process.env.COCKPIT_CASCADE_SESSIONS ?? join(homedir(), '.cockpit', 'cascade-sessions.json');

let keys: Set<string> | null = null;

function load(): Set<string> {
  if (keys) return keys;
  try {
    const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
    keys = new Set(Array.isArray(raw?.keys) ? raw.keys.filter((k: unknown) => typeof k === 'string') : []);
  } catch {
    keys = new Set();
  }
  return keys;
}

export function isCascadeSession(sessionKey: string): boolean {
  return load().has(sessionKey);
}

export function cascadeSessionKeys(): string[] {
  return [...load()];
}

export function setCascadeSession(sessionKey: string, on: boolean): void {
  const set = load();
  if (on) set.add(sessionKey);
  else set.delete(sessionKey);
  try {
    mkdirSync(dirname(STORE_PATH), { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify({ keys: [...set] }, null, 2));
  } catch { /* disco cheio/readonly: a marca vale pra esta execução */ }
}

// O servidor nunca re-keyeia um thread: uma sessão nova roda a vida inteira como
// 'new-xxx' enquanto o sessionId real só aparece no primeiro frame. Marcar por uma
// das duas chaves e consultar pela outra é o caminho normal, não a exceção (mesma
// dança de threadIsMarathon).
export function threadWantsCascade(sessionKey: string, sessionId?: string): boolean {
  return isCascadeSession(sessionKey) || (!!sessionId && isCascadeSession(sessionId));
}

export function __resetCascadeSessionCache(): void {
  keys = null;
}
