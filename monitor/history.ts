import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Sample, Health } from './probe';

// Histórico em JSONL: uma linha por sonda. Escolha deliberada de não usar banco —
// o monitor roda numa VPS free tier e dependência nativa (better-sqlite3) é a
// primeira coisa que quebra em build ARM. Append em arquivo texto sobrevive a
// queda no meio da escrita perdendo no máximo a última linha.
//
// Isto existe porque as métricas do Deck viviam só em memória e sumiam a cada
// restart. Sem série histórica não há como comprovar a meta de 99,5% do cronograma
// — a afirmação seria autoavaliação sem lastro.

export function appendSample(file: string, s: Sample): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(s)}\n`);
}

// Linha corrompida (queda no meio do append) é descartada em silêncio: um byte
// truncado no fim do arquivo não pode derrubar a leitura do histórico inteiro.
export function readSamples(file: string, sinceTs = 0): Sample[] {
  if (!existsSync(file)) return [];
  const out: Sample[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const s = JSON.parse(line) as Sample;
      if (typeof s.ts === 'number' && s.ts >= sinceTs) out.push(s);
    } catch { /* linha truncada */ }
  }
  return out;
}

export interface Availability {
  total: number;
  up: number;
  degraded: number;
  down: number;
  /** Relay respondendo (up + degraded) — é o SLO do que está sob nosso controle. */
  relayPct: number;
  /** Cadeia inteira de pé, incluindo o agente na box do usuário. */
  fullPct: number;
  p50LatencyMs: number | null;
}

const pct = (n: number, total: number): number => (total === 0 ? 0 : Math.round((n / total) * 10000) / 100);

export function availability(samples: Sample[]): Availability {
  const count = (h: Health) => samples.filter((s) => s.health === h).length;
  const up = count('up'), degraded = count('degraded'), down = count('down');
  const total = samples.length;
  const lat = samples.map((s) => s.latencyMs).filter((n): n is number => typeof n === 'number').sort((a, b) => a - b);
  return {
    total,
    up,
    degraded,
    down,
    relayPct: pct(up + degraded, total),
    fullPct: pct(up, total),
    p50LatencyMs: lat.length ? lat[Math.floor(lat.length / 2)] : null,
  };
}

// Reescreve o arquivo sem o que passou da janela. Chamado raramente (uma vez por
// dia); em ~1 sonda/min o arquivo de 90 dias fica na casa de poucas dezenas de MB.
export function prune(file: string, keepSinceTs: number): number {
  const kept = readSamples(file, keepSinceTs);
  writeFileSync(file, kept.map((s) => JSON.stringify(s)).join('\n') + (kept.length ? '\n' : ''));
  return kept.length;
}
