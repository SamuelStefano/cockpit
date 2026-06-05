import type { SysStats } from '../../shared/protocol';

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

export function StatusBar({ stats }: { stats: SysStats | null }) {
  if (!stats) {
    return (
      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-neutral-800 bg-neutral-950 px-3 text-[10.5px] text-neutral-600">
        <span className="font-mono">lendo telemetria…</span>
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
      <span className="ml-auto shrink-0 font-mono text-[10px] text-neutral-600">load {stats.load.toFixed(2)}</span>
    </footer>
  );
}
