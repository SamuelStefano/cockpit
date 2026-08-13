import { readFileSync, writeFileSync, mkdirSync, renameSync, openSync, closeSync, statSync, fstatSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Role } from '../auth';
import type { ParkedView } from '../../shared/protocol';
import { CONFIG } from '../config';
import { recordIncident } from './incidents';

// Fila ESTACIONADA (overnight/quota-out), distinta da fila `pending` do runs.ts
// (triagem in-turn, drenada no onClose). Aqui ficam os prompts que o usuário
// enfileirou pra rodar "quando der" — seja porque um turno está ocupado, seja
// porque a quota esgotou. O drainer (runs.ts) dispara cada item assim que a sessão
// fica ociosa, SEM depender do browser aberto. Travas: a pausa manual
// (setQueuePaused) e o teto de tokens (ws/quota.ts) — fora isso, se está na fila, VAI.
// Persistida em disco pra sobreviver a restart/reboot da VPS a noite toda.

const PARKED_PATH = process.env.COCKPIT_PARKED ?? join(homedir(), '.cockpit', 'parked.json');
// Flag de pausa manual da fila (global). Arquivo próprio pra não colidir com o mapa
// keyed-por-sessão do parked.json (uma sessão real casa o SESSION_KEY_RE).
const PAUSE_PATH = process.env.COCKPIT_QUEUE_PAUSE ?? join(homedir(), '.cockpit', 'queue-paused.json');
const SESSION_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// Teto de itens por sessão (espelha MAX_PENDING): cada item segura um prompt até
// maxPromptBytes; sem teto uma martelada acumula sem limite no arquivo.
const MAX_PARKED = 50;
// Teto de sessões distintas com fila, pra o arquivo não crescer sem limite.
const MAX_SESSIONS = 200;

export interface ParkedItem {
  id: string;
  prompt: string;
  resumeId?: string;
  mode?: string;
  model?: string;
  effort?: string;
  maxBudgetUsd?: number;
  bypass?: boolean;
  role?: Role;
  disallowedSkills?: string[];
  mcps?: string[];
  at: number;
  // Quantas vezes este item já voltou pra fila depois de um turno que não o consumiu.
  attempts?: number;
  // Bateu o teto de tentativas: continua guardado, mas o drainer para de disparar.
  held?: boolean;
}

// Teto de reenfileiramentos do MESMO item. Uma falha determinística (spawn quebrado,
// crash na primeira linha) devolveria o item pra sempre e o drainer o redispararia a
// cada 30s. No teto a fila inteira pausa: o prompt fica guardado e o usuário decide.
export const MAX_PARKED_ATTEMPTS = 3;

type ParkedMap = Record<string, ParkedItem[]>;

// Exportada porque o registro de turnos vivos (recover.ts) também guarda um item
// destes em disco e precisa tipar campo a campo antes de reexecutá-lo.
export function coerceItem(o: unknown): ParkedItem | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.prompt !== 'string') return null;
  return {
    id: r.id,
    prompt: r.prompt,
    resumeId: typeof r.resumeId === 'string' ? r.resumeId : undefined,
    mode: typeof r.mode === 'string' ? r.mode : undefined,
    model: typeof r.model === 'string' ? r.model : undefined,
    effort: typeof r.effort === 'string' ? r.effort : undefined,
    maxBudgetUsd: typeof r.maxBudgetUsd === 'number' ? r.maxBudgetUsd : undefined,
    bypass: r.bypass === true ? true : undefined,
    role: r.role === 'admin' || r.role === 'student' ? (r.role as Role) : undefined,
    disallowedSkills: Array.isArray(r.disallowedSkills) ? r.disallowedSkills.filter((x): x is string => typeof x === 'string') : undefined,
    mcps: Array.isArray(r.mcps) ? r.mcps.filter((x): x is string => typeof x === 'string') : undefined,
    at: typeof r.at === 'number' ? r.at : Date.now(),
    attempts: typeof r.attempts === 'number' ? r.attempts : undefined,
    held: r.held === true ? true : undefined,
  };
}

// Lê o arquivo a cada operação (sem cache): o drainer roda no processo do agente,
// mas os handlers queue-* podem rodar tanto no agente (relay) quanto no index
// (loopback). Ler o disco é a fonte de verdade compartilhada entre os processos —
// um cache em memória ficaria stale com a escrita do outro processo. Arquivo é
// pequeno e a frequência é humana, então o custo é irrelevante.
export function loadParked(): ParkedMap {
  try {
    const o = JSON.parse(readFileSync(PARKED_PATH, 'utf8'));
    if (!o || typeof o !== 'object') return {};
    const out: ParkedMap = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (!SESSION_KEY_RE.test(k) || !Array.isArray(v)) continue;
      const items = v.map(coerceItem).filter((x): x is ParkedItem => x !== null);
      if (items.length) out[k] = items;
    }
    return out;
  } catch {
    return {};
  }
}

function saveParked(map: ParkedMap): void {
  mkdirSync(dirname(PARKED_PATH), { recursive: true });
  // Escrita atômica: tmp + rename, pra um crash no meio não corromper o arquivo.
  const tmp = `${PARKED_PATH}.${process.pid}.tmp`;
  // 0600: cada item carrega role/bypass com que o drainer vai reexecutá-lo.
  writeFileSync(tmp, JSON.stringify(map, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, PARKED_PATH);
}

const LOCK_PATH = `${PARKED_PATH}.lock`;
// Dono do lock que morreu no meio (deploy, OOM) não pode travar a fila pra sempre.
const LOCK_STALE_MS = 5_000;

// Ler-modificar-escrever acontece em DOIS processos: o drainer roda no agente e os
// handlers queue-* podem rodar no index por loopback. Sem exclusão mútua a escrita
// de um sobrescreve a do outro — e a escrita perdida é um prompt do usuário.
function withParkedLock<T>(fn: () => T): T {
  mkdirSync(dirname(PARKED_PATH), { recursive: true });
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  let fd: number | undefined;
  for (let i = 0; i < 100 && fd === undefined; i++) {
    try {
      fd = openSync(LOCK_PATH, 'wx');
    } catch {
      try {
        if (Date.now() - statSync(LOCK_PATH).mtimeMs > LOCK_STALE_MS) rmSync(LOCK_PATH, { force: true });
      } catch { /* outro processo liberou entre o stat e o rm */ }
      Atomics.wait(sleeper, 0, 0, 5);
    }
  }
  // Sem o lock depois de ~500ms, segue mesmo assim: perder a corrida é raro, não
  // executar a operação (enfileirar, devolver) perderia o prompt com certeza.
  // Mas segue REGISTRADO — é a única janela em que a fila ainda pode perder um
  // item, e ela não pode voltar a ser silenciosa como era o bug original.
  if (fd === undefined) recordIncident({ kind: 'parked-lock-timeout', sessionKey: '-', detail: `lock preso ha >500ms em ${LOCK_PATH}` });
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
        if (statSync(LOCK_PATH).ino === ino) rmSync(LOCK_PATH, { force: true });
      } catch { /* já removido por reclaim de outro processo */ }
    }
  }
}

export function parkedView(): ParkedView[] {
  const map = loadParked();
  const out: ParkedView[] = [];
  for (const [sessionKey, items] of Object.entries(map)) {
    for (const it of items) out.push({ sessionKey, id: it.id, text: it.prompt, at: it.at, ...(it.held ? { held: true } : {}), ...(it.model ? { model: it.model } : {}) });
  }
  return out;
}

function newParkedId(): string {
  return `pk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Por que um enfileiramento foi recusado. O chamador PRECISA saber: o cliente já
// limpou o composer quando mandou, então uma recusa muda apaga o texto do usuário.
export type ParkedReject = 'sessao-invalida' | 'prompt-grande' | 'fila-cheia' | 'sessoes-demais';

export const REJECT_MESSAGE: Record<ParkedReject, string> = {
  'sessao-invalida': 'sessão inválida',
  'prompt-grande': 'o texto passa do tamanho máximo de um prompt',
  'fila-cheia': `a fila desta sessão está no teto de ${MAX_PARKED} itens`,
  'sessoes-demais': `já há ${MAX_SESSIONS} sessões com fila`,
};

// Enfileira. Retorna o id novo ou o motivo da recusa.
export function addParked(sessionKey: string, item: Omit<ParkedItem, 'id' | 'at'>): { id: string } | { reject: ParkedReject } {
  if (!SESSION_KEY_RE.test(sessionKey)) return { reject: 'sessao-invalida' };
  if (typeof item.prompt !== 'string' || Buffer.byteLength(item.prompt) > CONFIG.maxPromptBytes) return { reject: 'prompt-grande' };
  return withParkedLock(() => {
    const map = loadParked();
    const arr = map[sessionKey] ?? [];
    if (arr.length >= MAX_PARKED) return { reject: 'fila-cheia' as const };
    if (!(sessionKey in map) && Object.keys(map).length >= MAX_SESSIONS) return { reject: 'sessoes-demais' as const };
    const id = newParkedId();
    arr.push({ ...item, id, at: Date.now() });
    map[sessionKey] = arr;
    saveParked(map);
    return { id };
  });
}

// Espia um item sem tirá-lo da fila. Quem dispara fora do drainer precisa validar
// (contexto, quota) ANTES de tirar: devolver depois de uma recusa contaria uma
// tentativa falha que nunca houve e o item acabaria segurado por engano.
export function findParked(sessionKey: string, id: string): ParkedItem | null {
  return loadParked()[sessionKey]?.find((x) => x.id === id) ?? null;
}

// Tira UM item da fila e devolve ele inteiro (params inclusive), pra quem vai
// executá-lo fora do drainer — que só sabe pegar o topo. Mesma guarda do
// editParked: o item roda com o role/bypass de quem enfileirou, então disparar um
// item de admin sendo student seria privilégio herdado.
export function takeParked(sessionKey: string, id: string, role?: Role): ParkedItem | null {
  return withParkedLock(() => {
    const map = loadParked();
    const arr = map[sessionKey];
    const it = arr?.find((x) => x.id === id);
    if (!arr || !it) return null;
    if (it.role === 'admin' && role !== 'admin') return null;
    const next = arr.filter((x) => x.id !== id);
    if (next.length) map[sessionKey] = next; else delete map[sessionKey];
    saveParked(map);
    return it;
  });
}

export function removeParked(sessionKey: string, id: string): void {
  withParkedLock(() => {
    const map = loadParked();
    const arr = map[sessionKey];
    if (!arr) return;
    const next = arr.filter((x) => x.id !== id);
    if (next.length === arr.length) return;
    if (next.length) map[sessionKey] = next; else delete map[sessionKey];
    saveParked(map);
  });
}

// Troca o texto de um item já enfileirado NO LUGAR: preserva posição, id, `at` e os
// params com que ele foi criado (modelo/modo/bypass/skills). Remover e reenfileirar
// jogaria o item pro fim da fila e perderia esse contexto. Mesmas guardas do add.
// O item carrega o `role` de quem enfileirou, e o drainer roda com ele (inclusive
// bypass): reescrever o texto de um item de admin sendo student seria execução
// arbitrária com privilégio herdado, então só admin edita item de admin.
export function editParked(sessionKey: string, id: string, prompt: string, role?: Role): void {
  if (!SESSION_KEY_RE.test(sessionKey)) return;
  if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) return;
  withParkedLock(() => {
    const map = loadParked();
    const it = map[sessionKey]?.find((x) => x.id === id);
    if (!it) return;
    if (it.role === 'admin' && role !== 'admin') return;
    it.prompt = prompt;
    saveParked(map);
  });
}

export function clearParked(sessionKey: string): void {
  withParkedLock(() => {
    const map = loadParked();
    if (!(sessionKey in map)) return;
    delete map[sessionKey];
    saveParked(map);
  });
}

// Reordena: dir -1 sobe, +1 desce. O drainer sempre drena do topo, então a ordem
// aqui é a ordem de envio.
export function moveParked(sessionKey: string, id: string, dir: -1 | 1): void {
  withParkedLock(() => {
    const map = loadParked();
    const arr = map[sessionKey];
    if (!arr) return;
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    map[sessionKey] = arr;
    saveParked(map);
  });
}

// Remove e devolve o primeiro item da sessão (o drainer chama ao disparar).
export function shiftParked(sessionKey: string): ParkedItem | undefined {
  return withParkedLock(() => {
    const map = loadParked();
    const arr = map[sessionKey];
    if (!arr || arr.length === 0) return undefined;
    const first = arr.shift()!;
    if (arr.length) map[sessionKey] = arr; else delete map[sessionKey];
    saveParked(map);
    return first;
  });
}

// Devolve pro TOPO da fila um item já drenado (mesmo id, mesma posição). Usado
// quando o turno que ele subiu morreu sem consumir o prompt. Devolve quantas
// tentativas o item já acumulou — no teto o chamador pausa a fila.
// `bump: false` devolve SEM contar tentativa: o disparo avulso tira o item antes
// de spawnar, e uma falha ali não é o item falhando — contá-la o seguraria por
// um erro que nunca foi dele.
export function unshiftParked(sessionKey: string, item: ParkedItem, bump = true): number {
  if (!SESSION_KEY_RE.test(sessionKey)) return 0;
  return withParkedLock(() => {
    const map = loadParked();
    const arr = map[sessionKey] ?? [];
    if (arr.some((x) => x.id === item.id)) return 0;
    // Devolução IGNORA os tetos de propósito: o item já estava na fila, e recusá-lo
    // aqui apagaria um prompt do usuário pra respeitar um limite que existe só pra
    // barrar acúmulo de itens NOVOS. O teto de attempts é o que impede repetição.
    const attempts = (item.attempts ?? 0) + (bump ? 1 : 0);
    // No teto, o item é SEGURADO (não descartado): o drainer para de redisparar só
    // ele, e as outras sessões seguem drenando. Antes disto o teto pausava a fila
    // INTEIRA — uma falha determinística de um item travava a fila de todo mundo,
    // e o aviso ia por broadcast: com o browser fechado, ninguém via a pausa.
    arr.unshift({ ...item, attempts, ...(attempts >= MAX_PARKED_ATTEMPTS ? { held: true } : {}) });
    map[sessionKey] = arr;
    saveParked(map);
    return attempts;
  });
}

// Destrava um item segurado e zera as tentativas: o drainer volta a disparar.
export function retryParked(sessionKey: string, id: string): boolean {
  if (!SESSION_KEY_RE.test(sessionKey)) return false;
  return withParkedLock(() => {
    const map = loadParked();
    const it = map[sessionKey]?.find((x) => x.id === id);
    if (!it) return false;
    delete it.held;
    delete it.attempts;
    saveParked(map);
    return true;
  });
}

// Sessões com fila e o primeiro item de cada (candidatos a dreno neste tick).
export function parkedHeads(): { sessionKey: string; first: ParkedItem }[] {
  const map = loadParked();
  const out: { sessionKey: string; first: ParkedItem }[] = [];
  for (const [sessionKey, items] of Object.entries(map)) {
    if (items.length) out.push({ sessionKey, first: items[0] });
  }
  return out;
}

// --- pausa manual da fila ---------------------------------------------------

// Trava MANUAL do drainer: quando ligada, nenhum item dispara até o usuário retomar.
// Independente do gate de tokens (ws/quota.ts), que é automático e some no reset.
// Não há mais teto por janela/pontuação de uso. Lida do disco a cada
// chamada (fonte de verdade cross-process: o toggle pode chegar no index, o drainer
// roda no agente). Arquivo minúsculo, custo irrelevante.
export function isQueuePaused(): boolean {
  try {
    const o = JSON.parse(readFileSync(PAUSE_PATH, 'utf8'));
    return !!o && typeof o === 'object' && (o as { paused?: unknown }).paused === true;
  } catch {
    return false;
  }
}

export function setQueuePaused(paused: boolean): void {
  mkdirSync(dirname(PAUSE_PATH), { recursive: true });
  const tmp = `${PAUSE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ paused: paused === true }), 'utf8');
  renameSync(tmp, PAUSE_PATH);
}
