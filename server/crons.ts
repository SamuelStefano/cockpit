import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { Cron } from '../shared/protocol';

// Crons do Deck: dispara prompts agendados (turnos autônomos). Persistidos em
// ~/.cockpit/crons.json. Schedule minimalista: intervalo (a cada N min) ou diário
// (minuto do dia, hora local do servidor). A matemática de agendamento é pura
// (recebe `now`) pra ser testável; o I/O é separado.
const FILE = process.env.COCKPIT_CRONS ?? join(homedir(), '.cockpit', 'crons.json');

export async function getCrons(): Promise<Cron[]> {
  try { const j = JSON.parse(await readFile(FILE, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; }
}
async function writeCrons(list: Cron[]): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
}
export async function saveCron(c: Cron): Promise<Cron[]> {
  const all = await getCrons();
  const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0) all[i] = c; else all.push(c);
  await writeCrons(all);
  return all;
}
export async function deleteCron(id: string): Promise<Cron[]> {
  const all = (await getCrons()).filter((x) => x.id !== id);
  await writeCrons(all);
  return all;
}
async function markRan(id: string, now: number): Promise<void> {
  const all = await getCrons();
  const c = all.find((x) => x.id === id);
  if (c) { c.lastRun = now; await writeCrons(all); }
}

const DAY = 86_400_000;
function midnight(now: number): number { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }

// Próxima execução (pro display da UI). Intervalo: último + N min. Diário: o slot de
// hoje se ainda não passou/não rodou, senão o de amanhã.
export function nextRunAt(c: Cron, now: number): number {
  if (c.schedule.kind === 'interval') {
    const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
    return (c.lastRun ?? c.createdAt) + every;
  }
  const at = Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  const today = midnight(now) + at;
  const ranToday = !!c.lastRun && c.lastRun >= midnight(now);
  return now < today && !ranToday ? today : today + DAY;
}

// Está vencido AGORA (deve disparar)?
export function isDue(c: Cron, now: number): boolean {
  if (!c.enabled) return false;
  if (c.schedule.kind === 'interval') {
    const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
    return (c.lastRun ?? c.createdAt) + every <= now;
  }
  const slot = midnight(now) + Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  return now >= slot && (!c.lastRun || c.lastRun < slot);
}

// Loop do agendador: a cada CHECK_MS varre os crons e dispara os vencidos via o
// callback `fire` (a camada WS chama startRun). Marca lastRun ao disparar pra não
// repetir. Roda num processo só (o agente) pra não duplicar.
const CHECK_MS = 30_000;
export function startCronLoop(fire: (c: Cron) => void): void {
  const tick = async () => {
    let now: number;
    try { now = Date.now(); } catch { return; }
    const due = (await getCrons()).filter((c) => isDue(c, now));
    for (const c of due) {
      try { fire(c); await markRan(c.id, now); } catch { /* best-effort: não trava os outros */ }
    }
  };
  setInterval(() => { void tick(); }, CHECK_MS).unref();
}
