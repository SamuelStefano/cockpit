import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// Estado leve persistido do cockpit (fora do JSONL do CLI, que é só leitura).
// Hoje guarda só sessões ARQUIVADAS — esconder do sidebar sem deletar o history.
// Arquivo editável à mão pra desarquivar (não há UI de unhide ainda).
const STORE_PATH = process.env.COCKPIT_STORE ?? join(homedir(), '.cockpit', 'store.json');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Store { hidden: string[] }
let cache: Store | null = null;

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const o = JSON.parse(await readFile(STORE_PATH, 'utf8'));
    cache = { hidden: Array.isArray(o.hidden) ? o.hidden.filter((x: unknown) => typeof x === 'string') : [] };
  } catch {
    cache = { hidden: [] };
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

export async function hiddenSet(): Promise<Set<string>> {
  return new Set((await load()).hidden);
}

export async function hideSession(id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  const s = await load();
  if (!s.hidden.includes(id)) { s.hidden.push(id); await persist(); }
}

export async function unhideSession(id: string): Promise<void> {
  const s = await load();
  const i = s.hidden.indexOf(id);
  if (i >= 0) { s.hidden.splice(i, 1); await persist(); }
}
