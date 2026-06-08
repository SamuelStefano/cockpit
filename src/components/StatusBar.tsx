import { useState, useEffect } from 'react';
import type { SysStats, TurnStats } from '../../shared/protocol';
import { relReset } from '../lib/time';
import { CONTEXT_LIMIT, ctxPct } from '../lib/format';
import { fmtBytes, meterTone } from './statusBar.format';

// Stats do Claude na barra inferior: sempre visível, em todo layout. Reset do
// limite, % de contexto + tokens, duração do último turno (prompt→prompt).
function ClaudeStats({ rate, planReset, ctxTokens, lastTurn }: {
  rate: { resetsAt: number; status: string } | null;
  planReset?: number | null;
  ctxTokens: number;
  lastTurn?: TurnStats;
}) {
  const [, force] = useState(0);
  // Reset vem do rate-limit do CLI (pós-turno) OU do uso de plano (polled, vale
  // antes do 1º prompt) — assim "reset" aparece desde o boot, não só após enviar.
  const resetsAt = rate?.resetsAt || planReset || 0;
  useEffect(() => {
    if (!resetsAt) return;
    const id = setInterval(() => force((n) => (n + 1) % 1e6), 30_000);
    return () => clearInterval(id);
  }, [resetsAt]);
  const parts: { k: string; node: React.ReactNode }[] = [];
  if (resetsAt) {
    const limited = !!rate && rate.status !== 'allowed';
    parts.push({ k: 'rst', node: (
      <span className={`font-mono text-[10.5px] tabular-nums ${limited ? 'text-yellow-400' : 'text-neutral-300'}`} title={`Limite Claude: ${rate?.status ?? 'allowed'} — reseta em ${relReset(resetsAt)}`}>
        <span className="text-neutral-500">reset</span> {relReset(resetsAt)}
      </span>
    ) });
  }
  if (ctxTokens > 0) {
    const pct = ctxPct(ctxTokens);
    const tone = pct >= 75 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : 'text-neutral-300';
    parts.push({ k: 'ctx', node: (
      <span className={`font-mono text-[10.5px] tabular-nums ${tone}`} title={`Contexto: ~${ctxTokens.toLocaleString()} tokens (${pct}%)`}>
        <span className="text-neutral-500">ctx</span> {pct}% · {(ctxTokens / 1000).toFixed(0)}k
      </span>
    ) });
  }
  if (lastTurn?.durationMs !== undefined) {
    parts.push({ k: 'trn', node: (
      <span className="font-mono text-[10.5px] tabular-nums text-neutral-300" title={`Último turno: ${(lastTurn.durationMs / 1000).toFixed(1)}s${lastTurn.numTurns ? ` · ${lastTurn.numTurns} turnos` : ''}`}>
        <span className="text-neutral-500">turno</span> {(lastTurn.durationMs / 1000).toFixed(1)}s
      </span>
    ) });
  }
  if (!parts.length) return null;
  return (
    <>
      {parts.map((p, i) => (
        <span key={p.k} className="flex shrink-0 items-center gap-3.5">
          {i === 0 && <span className="h-3 w-px shrink-0 bg-neutral-800" />}
          {p.node}
          {i < parts.length - 1 && <span className="h-3 w-px shrink-0 bg-neutral-800" />}
        </span>
      ))}
    </>
  );
}

interface MeterProps {
  label: string;
  pct: number;
  detail: string;
}

function Meter({ label, pct, detail }: MeterProps) {
  const c = meterTone(pct);
  return (
    <div className="group relative flex items-center gap-1.5">
      <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-neutral-800">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: c, boxShadow: `0 0 6px ${c}` }}
        />
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-neutral-300">{Math.round(pct)}%</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[10px] text-neutral-200 shadow-xl group-hover:block">
        {detail}
      </span>
    </div>
  );
}

interface StatusBarProps {
  stats: SysStats | null;
  rate?: { resetsAt: number; status: string } | null;
  planReset?: number | null;
  ctxTokens?: number;
  lastTurn?: TurnStats;
}

export function StatusBar({ stats, rate = null, planReset = null, ctxTokens = 0, lastTurn }: StatusBarProps) {
  const claude = <ClaudeStats rate={rate} planReset={planReset} ctxTokens={ctxTokens} lastTurn={lastTurn} />;
  if (!stats) {
    return (
      <footer className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-neutral-800 bg-neutral-950 px-3 text-[10.5px] text-neutral-600">
        <span className="shrink-0 font-mono">lendo telemetria…</span>
        {claude}
      </footer>
    );
  }
  const memPct = stats.mem.total ? (stats.mem.used / stats.mem.total) * 100 : 0;
  const gpu = stats.gpu;
  const gpuMemPct = gpu && gpu.memTotal ? (gpu.memUsed / gpu.memTotal) * 100 : 0;
  const disk = stats.disk;
  const diskPct = disk && disk.total ? (disk.used / disk.total) * 100 : 0;
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3.5 overflow-x-auto border-t border-neutral-800 bg-neutral-950 px-3">
      <Meter label="cpu" pct={stats.cpu} detail={`CPU ${stats.cpu.toFixed(0)}% · load ${stats.load.toFixed(2)}`} />
      <span className="h-3 w-px shrink-0 bg-neutral-800" />
      <Meter label="ram" pct={memPct} detail={`RAM ${fmtBytes(stats.mem.used)} / ${fmtBytes(stats.mem.total)}`} />
      {disk && disk.total > 0 && (
        <>
          <span className="h-3 w-px shrink-0 bg-neutral-800" />
          <Meter label="disco" pct={diskPct} detail={`Disco ${fmtBytes(disk.used)} / ${fmtBytes(disk.total)} · ${fmtBytes(disk.total - disk.used)} livre`} />
        </>
      )}
      {gpu && (
        <>
          <span className="h-3 w-px shrink-0 bg-neutral-800" />
          <Meter label="gpu" pct={gpu.util} detail={`GPU ${gpu.util}% util`} />
          <span className="h-3 w-px shrink-0 bg-neutral-800" />
          <Meter label="vram" pct={gpuMemPct} detail={`VRAM ${fmtBytes(gpu.memUsed)} / ${fmtBytes(gpu.memTotal)}`} />
        </>
      )}
      {claude}
      {stats.saturated && (
        <span
          title={`VPS sob carga alta há ${stats.saturated.seconds}s (${[stats.saturated.cpu && 'CPU', stats.saturated.mem && 'RAM'].filter(Boolean).join(' + ')} acima de 92%). Considere parar runs pesados.`}
          className="flex shrink-0 items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-300"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
          carga alta {stats.saturated.seconds}s
        </span>
      )}
    </footer>
  );
}
