import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { Cron } from '../shared/protocol';
import { nextRunAt, isDue } from '../shared/cron-schedule';
import { withFileLockAsync } from './ws/file-lock';

export { nextRunAt, isDue };

// Crons do Deck: dispara prompts agendados (turnos autônomos). Persistidos em
// ~/.cockpit/crons.json. Schedule minimalista: intervalo (a cada N min), diário
// (minuto do dia, hora local do servidor) ou uma vez. A matemática de agendamento é pura
// (recebe `now`) pra ser testável; o I/O é separado.
// Path lido em runtime (não no load) pra ser testável via COCKPIT_CRONS.
function cronsFile(): string {
  return process.env.COCKPIT_CRONS ?? join(homedir(), '.cockpit', 'crons.json');
}

export async function getCrons(): Promise<Cron[]> {
  try { const j = JSON.parse(await readFile(cronsFile(), 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; }
}
async function writeCrons(list: Cron[]): Promise<void> {
  const file = cronsFile();
  await mkdir(dirname(file), { recursive: true });
  // Atômico: escreve no .tmp e renomeia — um crash no meio do write não corrompe
  // o crons.json. Tmp name per process + random: two processes write this file
  // (the index's scheduler, the agent's cron-save from the browser), and a shared
  // `.tmp` let one rename the other's half-written file into place — a torn
  // crons.json reads as [] and the next save wipes every cron.
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

// Mutex de escrita: saveCron/deleteCron/markRan fazem read-modify-write no MESMO
// arquivo; sem serialização, uma escrita da UI e o markRan do scheduler se
// atropelavam (lost update). Encadeia todas as mutações numa fila única.
let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  // The chain orders this process; the file lock orders it against the other one.
  // Without it markRan (index) and a cron-save (agent) could each read the old
  // list: a lost lastRun re-fires the same cron on the next tick.
  const locked = () => withFileLockAsync(cronsFile(), fn);
  const next = writeChain.then(locked, locked);
  writeChain = next.catch(() => {});
  return next;
}

export function saveCron(c: Cron): Promise<Cron[]> {
  return serialize(async () => {
    const all = await getCrons();
    const i = all.findIndex((x) => x.id === c.id);
    // lastRun and createdAt are the server's: the browser's list is only fetched on
    // mount, so an edit (or pause/resume) after a fire carried the old lastRun back
    // and isDue turned true again — a second autonomous turn within 30s.
    if (i >= 0) all[i] = { ...c, lastRun: all[i].lastRun, createdAt: all[i].createdAt }; else all.push(c);
    await writeCrons(all);
    return all;
  });
}
export function deleteCron(id: string): Promise<Cron[]> {
  return serialize(async () => {
    const all = (await getCrons()).filter((x) => x.id !== id);
    await writeCrons(all);
    return all;
  });
}
export function markRan(id: string, now: number): Promise<unknown> {
  return serialize(async () => {
    const all = await getCrons();
    const c = all.find((x) => x.id === id);
    if (!c) return;
    c.lastRun = now;
    // "uma vez" se auto-pausa ao disparar: fica no histórico sem contar como ativo
    // nem exibir uma próxima execução que já passou.
    if (c.schedule.kind === 'once') c.enabled = false;
    await writeCrons(all);
  });
}

// Manual "run now": records lastRun so the card shows it ran and an interval
// restarts its countdown. A one-shot is left alone, since marking it would pause
// it and drop the run still scheduled for later.
export function runCronNow(id: string, fire: (c: Cron) => void, now = Date.now()): Promise<Cron[] | null> {
  return serialize(async () => {
    const all = await getCrons();
    const c = all.find((x) => x.id === id);
    if (!c) return null;
    if (c.schedule.kind !== 'once') {
      c.lastRun = now;
      await writeCrons(all);
    }
    try { fire(c); } catch { /* the list is already persisted */ }
    return all;
  });
}

// Loop do agendador: a cada CHECK_MS varre os crons e dispara os vencidos via o
// callback `fire` (a camada WS chama startRun). Marca lastRun ao disparar pra não
// repetir. Roda SÓ no backend (onde vivem startRun/threads), nunca no agente-relay,
// pra não duplicar disparos.
const CHECK_MS = 30_000;
let ticking = false;
export function startCronLoop(fire: (c: Cron) => void): void {
  const tick = async () => {
    if (ticking) return; // sem overlap entre ticks
    ticking = true;
    try {
      const now = Date.now();
      const due = (await getCrons()).filter((c) => isDue(c, now));
      for (const c of due) {
        // markRan ANTES de disparar: uma varredura concorrente já vê o cron como
        // rodado (não dispara em dobro). best-effort no fire.
        await markRan(c.id, now);
        try { fire(c); } catch { /* não trava os outros */ }
      }
    } catch { /* leitura falhou: tenta no próximo tick */ } finally { ticking = false; }
  };
  // setTimeout encadeado (re-arma só após a tick resolver) em vez de setInterval —
  // garante que ticks nunca se sobreponham mesmo se um fire/IO demorar.
  const loop = () => { void tick().finally(() => { setTimeout(loop, CHECK_MS).unref(); }); };
  setTimeout(loop, CHECK_MS).unref();
}
