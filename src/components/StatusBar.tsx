import { useState, useEffect } from 'react';
import type { SysStats, TurnStats } from '../../shared/protocol';

const CTX_LIMIT = 200_000;

function relReset(resetsAt: number): string {
  const diff = resetsAt - Date.now();
  if (diff <= 0) return 'agora';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

// Stats do Claude na barra inferior: sempre visível, em todo layout. Reset do
// limite, % de contexto + tokens, duração do último turno (prompt→prompt).
function ClaudeStats({ rate, ctxTokens, lastTurn }: {
  rate: { resetsAt: number; status: string } | null;
  ctxTokens: number;
  lastTurn?: TurnStats;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!rate) return;
    const id = setInterval(() => force((n) => (n + 1) % 1e6), 30_000);
    return () => clearInterval(id);
  }, [rate]);
  const parts: { k: string; node: React.ReactNode }[] = [];
  if (rate) {
    const limited = rate.status !== 'allowed';
    parts.push({ k: 'rst', node: (
      <span className={`font-mono text-[10.5px] tabular-nums ${limited ? 'text-yellow-400' : 'text-neutral-300'}`} title={`Limite Claude: ${rate.status} — reseta em ${relReset(rate.resetsAt)}`}>
        <span className="text-neutral-500">reset</span> {relReset(rate.resetsAt)}
      </span>
    ) });
  }
  if (ctxTokens > 0) {
    const pct = Math.min(100, Math.round((ctxTokens / CTX_LIMIT) * 100));
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

function fmtBytes(b: number): string {
  if (!b) return '0';
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)}G`;
  return `${Math.round(b / 1024 ** 2)}M`;
}

function tone(pct: number): string {
  if (pct >= 90) return 'var(--err)';
  if (pct >= 70) return 'var(--warn)';
  return 'var(--ok)';
}

interface MeterProps {
  label: string;
  pct: number;
  detail: string;
}

function Meter({ label, pct, detail }: MeterProps) {
  const c = tone(pct);
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
  ctxTokens?: number;
  lastTurn?: TurnStats;
}

export function StatusBar({ stats, rate = null, ctxTokens = 0, lastTurn }: StatusBarProps) {
  const claude = <ClaudeStats rate={rate} ctxTokens={ctxTokens} lastTurn={lastTurn} />;
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
      <span className="ml-auto shrink-0 font-mono text-[10px] text-neutral-600">load {stats.load.toFixed(2)}</span>
    </footer>
  );
}
