import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Role } from '../auth';
import type { PlanUsage, ParkedView } from '../../shared/protocol';
import { CONFIG } from '../config';

// Fila ESTACIONADA (overnight/quota-out), distinta da fila `pending` do runs.ts
// (triagem in-turn, drenada no onClose). Aqui ficam os prompts que o usuário
// enfileirou pra rodar "quando der" — seja porque um turno está ocupado, seja
// porque a quota esgotou. O drainer (runs.ts) dispara cada item quando a sessão
// fica ociosa E a quota está disponível E o teto por janela não estourou, SEM
// depender do browser estar aberto naquela sessão (o bug: "preciso entrar na
// sessão pra a fila enviar"). Persistida em disco pra sobreviver a restart/reboot
// da VPS a noite toda.

const PARKED_PATH = process.env.COCKPIT_PARKED ?? join(homedir(), '.cockpit', 'parked.json');
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
}

type ParkedMap = Record<string, ParkedItem[]>;

function coerceItem(o: unknown): ParkedItem | null {
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
    role: typeof r.role === 'string' ? (r.role as Role) : undefined,
    disallowedSkills: Array.isArray(r.disallowedSkills) ? r.disallowedSkills.filter((x): x is string => typeof x === 'string') : undefined,
    mcps: Array.isArray(r.mcps) ? r.mcps.filter((x): x is string => typeof x === 'string') : undefined,
    at: typeof r.at === 'number' ? r.at : Date.now(),
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
  writeFileSync(tmp, JSON.stringify(map, null, 2), 'utf8');
  renameSync(tmp, PARKED_PATH);
}

export function parkedView(): ParkedView[] {
  const map = loadParked();
  const out: ParkedView[] = [];
  for (const [sessionKey, items] of Object.entries(map)) {
    for (const it of items) out.push({ sessionKey, id: it.id, text: it.prompt, at: it.at });
  }
  return out;
}

function newParkedId(): string {
  return `pk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Enfileira. Retorna o id novo ou null (chave inválida, prompt grande, teto).
export function addParked(sessionKey: string, item: Omit<ParkedItem, 'id' | 'at'>): string | null {
  if (!SESSION_KEY_RE.test(sessionKey)) return null;
  if (typeof item.prompt !== 'string' || Buffer.byteLength(item.prompt) > CONFIG.maxPromptBytes) return null;
  const map = loadParked();
  const arr = map[sessionKey] ?? [];
  if (arr.length >= MAX_PARKED) return null;
  if (!(sessionKey in map) && Object.keys(map).length >= MAX_SESSIONS) return null;
  const id = newParkedId();
  arr.push({ ...item, id, at: Date.now() });
  map[sessionKey] = arr;
  saveParked(map);
  return id;
}

export function removeParked(sessionKey: string, id: string): void {
  const map = loadParked();
  const arr = map[sessionKey];
  if (!arr) return;
  const next = arr.filter((x) => x.id !== id);
  if (next.length === arr.length) return;
  if (next.length) map[sessionKey] = next; else delete map[sessionKey];
  saveParked(map);
}

export function clearParked(sessionKey: string): void {
  const map = loadParked();
  if (!(sessionKey in map)) return;
  delete map[sessionKey];
  saveParked(map);
}

// Reordena: dir -1 sobe, +1 desce. O drainer sempre drena do topo, então a ordem
// aqui é a ordem de envio.
export function moveParked(sessionKey: string, id: string, dir: -1 | 1): void {
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
}

// Remove e devolve o primeiro item da sessão (o drainer chama ao disparar).
export function shiftParked(sessionKey: string): ParkedItem | undefined {
  const map = loadParked();
  const arr = map[sessionKey];
  if (!arr || arr.length === 0) return undefined;
  const first = arr.shift()!;
  if (arr.length) map[sessionKey] = arr; else delete map[sessionKey];
  saveParked(map);
  return first;
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

// --- pausa por quota (espelha o gate do cliente em App.tsx) -----------------

// Pura (testável): a janela está pausada? fiveHour>=99.5 e reset não passou, OU
// um limite duro do CLI (rate.status !== 'allowed' com reset futuro).
export function computePaused(
  usage: PlanUsage | null | undefined,
  rate: { resetsAt: number; status: string } | null | undefined,
  now: number,
): boolean {
  const resetPassed = !!usage?.resetsAt && usage.resetsAt <= now;
  const fiveHourOut = !!usage && usage.fiveHour >= 99.5 && !resetPassed;
  const rateLimited = !!rate && rate.status !== 'allowed' && (!rate.resetsAt || rate.resetsAt > now);
  return fiveHourOut || rateLimited;
}

// --- teto por janela (guard-rail escolhido pelo Samuel) ---------------------

// Quantos itens o drainer pode disparar automaticamente por janela de 5h. Sem
// isto, uma fila grande queimaria a quota inteira sozinha no reset. Reinicia a
// contagem quando a janela reseta (resetsAt muda). Configurável por env.
export const WINDOW_CAP = Math.max(1, Number(process.env.DECK_PARKED_WINDOW_CAP) || 25);
let windowKey: number | null = null;
let windowCount = 0;

// Chave da janela atual = resetsAt do plano (muda a cada reset de 5h). null quando
// ainda não há dado de usage; aí usamos uma chave estável pra não zerar à toa.
function keyFor(usage: PlanUsage | null | undefined): number {
  return usage?.resetsAt ?? 0;
}

// Sob o teto? Reseta a contagem ao detectar janela nova (resetsAt diferente).
export function underWindowCap(usage: PlanUsage | null | undefined): boolean {
  const k = keyFor(usage);
  if (k !== windowKey) { windowKey = k; windowCount = 0; }
  return windowCount < WINDOW_CAP;
}

// Contabiliza um dreno na janela atual.
export function noteWindowDrain(usage: PlanUsage | null | undefined): void {
  const k = keyFor(usage);
  if (k !== windowKey) { windowKey = k; windowCount = 0; }
  windowCount++;
}

// Só p/ teste: estado do contador de janela.
export function windowState(): { key: number | null; count: number; cap: number } {
  return { key: windowKey, count: windowCount, cap: WINDOW_CAP };
}
export function resetWindowState(): void { windowKey = null; windowCount = 0; }
