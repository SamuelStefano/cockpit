import type { SysStats } from '../../shared/protocol';

export function fmtBytes(b: number): string {
  if (!b) return '0';
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)}G`;
  return `${Math.round(b / 1024 ** 2)}M`;
}

export function meterTone(pct: number): string {
  if (pct >= 90) return 'var(--err)';
  if (pct >= 70) return 'var(--warn)';
  return 'var(--ok)';
}

export interface VpsMeter { id: string; label: string; pct: number; detail: string }

// The StatusBar's meters as data, so the usage popover shows the same readings.
export function vpsMeters(stats: SysStats): VpsMeter[] {
  const out: VpsMeter[] = [
    { id: 'cpu', label: 'CPU', pct: stats.cpu, detail: `load ${stats.load.toFixed(2)}` },
    { id: 'ram', label: 'RAM', pct: stats.mem.total ? (stats.mem.used / stats.mem.total) * 100 : 0, detail: `${fmtBytes(stats.mem.used)} / ${fmtBytes(stats.mem.total)}` },
  ];
  const d = stats.disk;
  if (d && d.total > 0) out.push({ id: 'disk', label: 'Disco', pct: (d.used / d.total) * 100, detail: `${fmtBytes(d.total - d.used)} livre` });
  const g = stats.gpu;
  if (g) {
    out.push({ id: 'gpu', label: 'GPU', pct: g.util, detail: `${g.util}% util` });
    out.push({ id: 'vram', label: 'VRAM', pct: g.memTotal ? (g.memUsed / g.memTotal) * 100 : 0, detail: `${fmtBytes(g.memUsed)} / ${fmtBytes(g.memTotal)}` });
  }
  return out;
}
