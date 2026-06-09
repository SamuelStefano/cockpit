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

// Linha discreta "Xs · N.Nk tok" enquanto o turno roda. Tokens só aparecem quando
// já há gasto medido (>0); o tempo a partir de 3s pra não piscar à toa.
export function LiveStatsLine({ live }: { live: LiveTurn }) {
  const secs = useElapsed(live.startedAt);
  const parts: string[] = [];
  if (secs >= 3) parts.push(fmtElapsed(secs));
  if (live.tokens > 0) parts.push(`${fmtTokensK(live.tokens)} tok`);
  if (!parts.length) return null;
  return (
    <span className="text-[11px] tabular-nums text-neutral-600" title="Turno em andamento: tempo decorrido · tokens gastos neste turno">
      {parts.join(' · ')}
    </span>
  );
}

export function ThinkingDots({ live }: { live?: LiveTurn }) {
  return (
    <div className="flex items-center gap-2 pt-1.5">
      <div className="flex items-center gap-1">
        <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '0ms' }} />
        <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '160ms' }} />
        <span className="think-dot h-1.5 w-1.5 rounded-full bg-orange-400" style={{ animationDelay: '320ms' }} />
      </div>
      <span className="text-[12px] text-neutral-500">pensando…</span>
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
