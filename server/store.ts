import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// Estado leve persistido do cockpit (fora do JSONL do CLI, que é só leitura).
// Hoje guarda só sessões ARQUIVADAS — esconder do sidebar sem deletar o history.
// Arquivo editável à mão pra desarquivar (não há UI de unhide ainda).
const STORE_PATH = process.env.COCKPIT_STORE ?? join(homedir(), '.cockpit', 'store.json');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// `purged` = "excluída": some de TODA listagem (sidebar e arquivadas), mas o
// JSONL no disco fica intacto — exclusão é só do cockpit, nunca apaga o history.
interface Store { hidden: string[]; purged: string[]; titles: Record<string, string>; notes: Record<string, string> }
let cache: Store | null = null;

// Só pares com chave UUID e valor string entram nos overrides (anti-lixo no disco).
function cleanMap(o: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (UUID_RE.test(k) && typeof v === 'string') out[k] = v;
    }
  }
  return out;
}

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const o = JSON.parse(await readFile(STORE_PATH, 'utf8'));
    cache = {
      hidden: Array.isArray(o.hidden) ? o.hidden.filter((x: unknown) => typeof x === 'string') : [],
      purged: Array.isArray(o.purged) ? o.purged.filter((x: unknown) => typeof x === 'string') : [],
      titles: cleanMap(o.titles),
      notes: cleanMap(o.notes),
    };
  } catch {
    cache = { hidden: [], purged: [], titles: {}, notes: {} };
  }
  return cache;
}

// Persiste o estado novo no disco e SÓ DEPOIS adota como cache. Se a escrita
// falhar (disco cheio/permissão), o cache em memória segue casado com o disco —
// senão a UI mostraria a sessão escondida que sumiria no próximo restart.
async function commit(next: Store): Promise<void> {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  // Escrita atômica: tmp + rename, pra um crash no meio não corromper o store.
  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
  await rename(tmp, STORE_PATH);
  cache = next;
}

export async function hiddenSet(): Promise<Set<string>> {
  return new Set((await load()).hidden);
}

export async function purgedSet(): Promise<Set<string>> {
  return new Set((await load()).purged);
}

// Overrides manuais de título/descrição (o usuário edita; ganham do derivado do
// JSONL e do resumo IA). Mapas crus pra a listagem aplicar por id.
export async function titleOverrides(): Promise<Record<string, string>> {
  return (await load()).titles;
}
export async function noteOverrides(): Promise<Record<string, string>> {
  return (await load()).notes;
}

// Grava (ou limpa, com texto vazio) o override. Cap em 200 chars no título e
// 2000 na descrição pra não inchar o store.json.
export async function setTitle(id: string, title: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  await serialize(async () => {
    const s = await load();
    const v = title.trim().slice(0, 200);
    const titles = { ...s.titles };
    if (v) titles[id] = v; else delete titles[id];
    await commit({ ...s, titles });
  });
}
export async function setNote(id: string, note: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  await serialize(async () => {
    const s = await load();
    const v = note.trim().slice(0, 2000);
    const notes = { ...s.notes };
    if (v) notes[id] = v; else delete notes[id];
    await commit({ ...s, notes });
  });
}

// Serializa as mutações: hide/unhide fazem read-modify-write sobre o cache e,
// sem fila, duas chamadas concorrentes leem o mesmo snapshot e a segunda commit
// sobrescreve a primeira (update perdido). A fila garante que cada mutação veja
// o estado já commitado pela anterior; de quebra, nunca há dois commits no ar
// disputando o mesmo arquivo .tmp.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export async function hideSession(id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  await serialize(async () => {
    const s = await load();
    if (!s.hidden.includes(id)) await commit({ ...s, hidden: [...s.hidden, id] });
  });
}

export async function unhideSession(id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  await serialize(async () => {
    const s = await load();
    if (s.hidden.includes(id)) await commit({ ...s, hidden: s.hidden.filter((x) => x !== id) });
  });
}

// "Excluir": tira de toda listagem (sidebar + arquivadas) e limpa overrides do id.
// NÃO toca no .jsonl — o history continua no disco, só some do cockpit.
export async function purgeSession(id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  await serialize(async () => {
    const s = await load();
    if (s.purged.includes(id)) return;
    const titles = { ...s.titles }; delete titles[id];
    const notes = { ...s.notes }; delete notes[id];
    await commit({
      ...s,
      hidden: s.hidden.filter((x) => x !== id),
      purged: [...s.purged, id],
      titles,
      notes,
    });
  });
}
