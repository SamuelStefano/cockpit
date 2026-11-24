import { useState, useEffect } from 'react';
import { Bit } from '../bit/Bit';
import type { BitState } from '../bit/bit-state';
import { CompactingLine } from './CompactingLine';
import { fmtElapsed, useElapsed } from './elapsed';
import { fmtTokens } from './message-format';

// Stats AO VIVO do turno em andamento (estilo terminal): tempo decorrido + tokens
// gastos NESTE turno. `startedAt` (ts do início do turno) sobrevive a remontagem
// no reconnect; sem ele cai no relógio local do componente. `compactingSince`
// carimba quando o silêncio da compactação começou (ver [[compacting]]).
export interface LiveTurn { tokens: number; startedAt?: number; compactingSince?: number }

// Tokens compactos: 1.2k, 18k, 1.3M. Abaixo de 1000 mostra o número cru.
export const fmtTokensK = fmtTokens;

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
    <span className="text-[12px] tabular-nums text-neutral-600" title="Turno em andamento: tempo decorrido · estimativa de tokens de saída neste turno">
      {parts.join(' · ')}
    </span>
  );
}

// Verbos rotativos como no terminal — quebram a monotonia do "pensando…" fixo.
export const SPINNER_VERBS = ['Pensando', 'Maquinando', 'Cozinhando', 'Tramando', 'Destilando', 'Garimpando', 'Orquestrando', 'Lapidando', 'Tecendo', 'Conjurando'] as const;
export function spinnerVerb(i: number): string {
  return SPINNER_VERBS[((i % SPINNER_VERBS.length) + SPINNER_VERBS.length) % SPINNER_VERBS.length];
}

function useSpinnerVerb(): string {
  // Verbo inicial aleatório pra turnos seguidos não abrirem sempre com o mesmo.
  const [seed] = useState(() => Math.floor(Math.random() * SPINNER_VERBS.length));
  const [verbI, setVerbI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const v = setInterval(() => setVerbI((i) => i + 1), 6000);
    return () => clearInterval(v);
  }, []);
  return spinnerVerb(seed + verbI);
}

// `bit` only where no avatar sits beside the line (tool/notes boxes); under a
// bubble the avatar already is the live Bit.
export function ThinkingDots({ live, bit }: { live?: LiveTurn; bit?: BitState }) {
  const verb = useSpinnerVerb();
  if (live?.compactingSince) return <CompactingLine since={live.compactingSince} />;
  return (
    <div className="flex items-center gap-2 pt-1.5">
      {bit && <Bit state={bit} size={20} className="-my-1" />}
      <span className="text-[13px] text-neutral-500">{verb}…</span>
      {live ? <LiveStatsLine live={live} /> : <FallbackElapsed />}
    </div>
  );
}

// Sem dados de turno ao vivo (ex: replay sem startedAt): só o cronômetro local.
function FallbackElapsed() {
  const secs = useElapsed();
  return secs >= 3 ? <span className="text-[12px] tabular-nums text-neutral-600">{fmtElapsed(secs)}</span> : null;
}

export function Thinking({ live, bit = 'thinking' }: { live?: LiveTurn; bit?: BitState }) {
  return (
    <div className="fade-up flex gap-2.5">
      <div className="mt-0.5">
        <Bit state={bit} size={28} />
      </div>
      <ThinkingDots live={live} />
    </div>
  );
}
