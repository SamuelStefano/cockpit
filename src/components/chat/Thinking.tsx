import { useState, useEffect } from 'react';
import { ClaudeAvatar } from '../ClaudeAvatar';

// Stats AO VIVO do turno em andamento (estilo terminal): tempo decorrido + tokens
// gastos NESTE turno. `startedAt` (ts do início do turno) sobrevive a remontagem
// no reconnect; sem ele cai no relógio local do componente.
export interface LiveTurn { tokens: number; startedAt?: number }

function fmtElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// Tokens compactos: 1.2k, 18k, 1.3M. Abaixo de 1000 mostra o número cru.
export function fmtTokensK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

function useElapsed(startedAt?: number): number {
  const [secs, setSecs] = useState(() => (startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0));
  useEffect(() => {
    const base = startedAt ?? Date.now();
    const id = setInterval(() => setSecs(Math.max(0, Math.floor((Date.now() - base) / 1000))), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return secs;
}

// Linha discreta "Xs · N.Nk tok" enquanto o turno roda. Mostra o tempo desde 1s
// (igual ao terminal, que conta do início) e os tokens assim que a saída começa
// a fazer streaming (estimativa ao vivo ~4 chars/token).
export function LiveStatsLine({ live }: { live: LiveTurn }) {
  const secs = useElapsed(live.startedAt);
  const parts: string[] = [];
  if (secs >= 1) parts.push(fmtElapsed(secs));
  if (live.tokens > 0) parts.push(`~${fmtTokensK(live.tokens)} tokens`);
  if (!parts.length) return null;
  return (
    <span className="text-[11px] tabular-nums text-neutral-600" title="Turno em andamento: tempo decorrido · estimativa de tokens de saída neste turno">
      {parts.join(' · ')}
    </span>
  );
}

// Estrelinha pulsante do terminal: a sequência cresce e encolhe (ping-pong),
// igual ao spinner do Claude Code. Pura e exportada pra teste.
const GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽'] as const;
export function spinnerGlyph(tick: number): string {
  const period = (GLYPHS.length - 1) * 2;
  const t = ((tick % period) + period) % period;
  return GLYPHS[t < GLYPHS.length ? t : period - t];
}

// Verbos rotativos como no terminal — quebram a monotonia do "pensando…" fixo.
export const SPINNER_VERBS = ['Pensando', 'Maquinando', 'Cozinhando', 'Tramando', 'Destilando', 'Garimpando', 'Orquestrando', 'Lapidando', 'Tecendo', 'Conjurando'] as const;
export function spinnerVerb(i: number): string {
  return SPINNER_VERBS[((i % SPINNER_VERBS.length) + SPINNER_VERBS.length) % SPINNER_VERBS.length];
}

function useSpinner(): { glyph: string; verb: string } {
  // Verbo inicial aleatório pra turnos seguidos não abrirem sempre com o mesmo.
  const [seed] = useState(() => Math.floor(Math.random() * SPINNER_VERBS.length));
  const [tick, setTick] = useState(0);
  const [verbI, setVerbI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const g = setInterval(() => setTick((t) => t + 1), 140);
    const v = setInterval(() => setVerbI((i) => i + 1), 6000);
    return () => { clearInterval(g); clearInterval(v); };
  }, []);
  return { glyph: spinnerGlyph(tick), verb: spinnerVerb(seed + verbI) };
}

export function ThinkingDots({ live }: { live?: LiveTurn }) {
  const { glyph, verb } = useSpinner();
  return (
    <div className="flex items-center gap-2 pt-1.5">
      <span className="spinner-star inline-block w-4 text-center text-[15px] leading-none text-orange-400" aria-hidden>
        {glyph}
      </span>
      <span className="text-[12px] text-neutral-500">{verb}…</span>
      {live ? <LiveStatsLine live={live} /> : <FallbackElapsed />}
    </div>
  );
}

// Sem dados de turno ao vivo (ex: replay sem startedAt): só o cronômetro local.
function FallbackElapsed() {
  const secs = useElapsed();
  return secs >= 3 ? <span className="text-[11px] tabular-nums text-neutral-600">{fmtElapsed(secs)}</span> : null;
}

export function Thinking({ live }: { live?: LiveTurn }) {
  return (
    <div className="fade-up flex gap-2.5">
      <div className="mt-0.5">
        <ClaudeAvatar size={28} />
      </div>
      <ThinkingDots live={live} />
    </div>
  );
}
