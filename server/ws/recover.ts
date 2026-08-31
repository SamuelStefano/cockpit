import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { withFileLock } from './file-lock';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { RunParams } from './runs';
import { coerceItem, type ParkedItem } from './parked';

// Registro em disco dos turnos VIVOS. A retomada automática do runs.ts cobre o
// turno que morre sozinho, mas não o caso em que o AGENTE inteiro cai (restart,
// OOM, deploy): aí todos os `claude -p` filhos morrem junto e não sobra processo
// pra perceber — o chat fica mudo até o usuário reclamar. Este arquivo é a memória
// que atravessa o restart: quem estiver aqui quando o agente sobe é um turno que
// não fechou, e é retomado no boot.
const LIVE_PATH = process.env.COCKPIT_LIVE_RUNS ?? join(homedir(), '.cockpit', 'live-runs.json');

// Turno mais velho que isto não é retomado no boot: uma VPS que ficou dias fora
// voltaria disparando trabalho que o usuário já esqueceu (e pagando por ele).
export const ORPHAN_MAX_AGE_MS = 60 * 60_000;
// Teto de retomadas por boot — um arquivo corrompido/inchado não pode virar uma
// tempestade de turnos simultâneos no arranque.
export const ORPHAN_MAX_RESUMES = 5;

export interface LiveRun {
  sessionKey: string;
  sessionId: string;
  params: RunParams;
  startedAt: number;
  // Item da fila estacionada que ESTE turno subiu, enquanto ele ainda não produziu
  // nada. O drainer tira o item do parked.json antes de rodar, então sem isto uma
  // morte do processo inteiro (deploy/OOM) levava o prompt junto: o boot só sabia
  // retomar com "continue de onde parou", que não é o prompt do usuário.
  parked?: ParkedItem;
  // Sessão de onde o item saiu. No disparo avulso o turno roda com a chave do FORK,
  // então devolver o item por `sessionKey` o jogaria numa fila fantasma.
  parkedFrom?: string;
}

type LiveMap = Record<string, LiveRun>;

function read(): LiveMap {
  try {
    const o = JSON.parse(readFileSync(LIVE_PATH, 'utf8'));
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as LiveMap) : {};
  } catch { return {}; }
}

function write(map: LiveMap): void {
  mkdirSync(dirname(LIVE_PATH), { recursive: true });
  const tmp = `${LIVE_PATH}.${process.pid}.tmp`;
  // 0600: guarda role/bypass do turno, que o boot vai reexecutar sem passar por authz.
  writeFileSync(tmp, JSON.stringify(map), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, LIVE_PATH);
}

// Mesma trava do parked.json, pelo mesmo motivo: agente e index escrevem aqui. Um
// `markRunLive` perdido some com o único registro de que o turno estava vivo, e o
// boot seguinte não o retoma — o turno morre com o processo, calado.
export function markRunLive(entry: LiveRun): void {
  withFileLock(LIVE_PATH, () => {
    const map = read();
    map[entry.sessionKey] = entry;
    write(map);
  });
}

export function clearRunLive(sessionKey: string): void {
  withFileLock(LIVE_PATH, () => {
    const map = read();
    if (!(sessionKey in map)) return;
    delete map[sessionKey];
    write(map);
  });
}

// Pura (testável): quais órfãos merecem retomada. Descarta os velhos demais e
// corta no teto, do mais recente pro mais antigo. Os tetos existem pra não DISPARAR
// trabalho esquecido no boot; quem carrega item de fila escapa deles porque não vira
// turno — volta pra fila, que já é o lugar onde um prompt espera sem prazo.
export function pickOrphans(map: LiveMap, now: number, maxAgeMs = ORPHAN_MAX_AGE_MS, cap = ORPHAN_MAX_RESUMES): LiveRun[] {
  const all = Object.values(map)
    .filter((r) => r && typeof r.sessionKey === 'string' && typeof r.sessionId === 'string' && typeof r.startedAt === 'number')
    .map((r) => ({ ...r, params: sanitize(r.params), parked: coerceItem(r.parked) ?? undefined, parkedFrom: typeof r.parkedFrom === 'string' ? r.parkedFrom : undefined }))
    .sort((a, b) => b.startedAt - a.startedAt);
  const withParked = all.filter((r) => r.parked);
  const resumable = all.filter((r) => !r.parked && now - r.startedAt <= maxAgeMs).slice(0, cap);
  return [...withParked, ...resumable];
}

// Params vindos do disco vão direto pra um `claude -p` sem passar por authz (o boot
// não tem usuário pedindo nada). Tipa cada campo pra um arquivo corrompido/editado
// não injetar flag no CLI — mesmo padrão do parked.ts.
function sanitize(p: unknown): RunParams {
  const r = (p ?? {}) as Record<string, unknown>;
  return {
    mode: typeof r.mode === 'string' ? r.mode : undefined,
    model: typeof r.model === 'string' ? r.model : undefined,
    maxBudgetUsd: typeof r.maxBudgetUsd === 'number' ? r.maxBudgetUsd : undefined,
    bypass: r.bypass === true,
    role: r.role === 'admin' || r.role === 'student' ? r.role : undefined,
    disallowedSkills: Array.isArray(r.disallowedSkills) ? r.disallowedSkills.filter((s): s is string => typeof s === 'string') : undefined,
    mcps: Array.isArray(r.mcps) ? r.mcps.filter((s): s is string => typeof s === 'string') : undefined,
    effort: typeof r.effort === 'string' ? r.effort : undefined,
  };
}

// Lê os órfãos e ZERA o arquivo na mesma passada: o boot é a única chance de
// retomar, e deixar o registro pra trás faria o próximo restart tentar de novo em
// loop. O registro dos turnos novos é reescrito pelo markRunLive.
export function takeOrphanRuns(now = Date.now()): LiveRun[] {
  const map = read();
  if (Object.keys(map).length === 0) return [];
  const orphans = pickOrphans(map, now);
  try { unlinkSync(LIVE_PATH); } catch { /* já não existe */ }
  return orphans;
}
