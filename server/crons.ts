import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { Cron } from '../shared/protocol';
import { nextRunAt, isDue } from '../shared/cron-schedule';

export { nextRunAt, isDue };

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
  // Atômico: escreve no .tmp e renomeia — um crash no meio do write não corrompe
  // o crons.json. Serializado pelo mutex abaixo (escritor único), então .tmp fixo basta.
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await rename(tmp, FILE);
}

// Mutex de escrita: saveCron/deleteCron/markRan fazem read-modify-write no MESMO
// arquivo; sem serialização, uma escrita da UI e o markRan do scheduler se
// atropelavam (lost update). Encadeia todas as mutações numa fila única.
let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

export function saveCron(c: Cron): Promise<Cron[]> {
  return serialize(async () => {
    const all = await getCrons();
    const i = all.findIndex((x) => x.id === c.id);
    if (i >= 0) all[i] = c; else all.push(c);
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
function markRan(id: string, now: number): Promise<unknown> {
  return serialize(async () => {
    const all = await getCrons();
    const c = all.find((x) => x.id === id);
    if (c) { c.lastRun = now; await writeCrons(all); }
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
