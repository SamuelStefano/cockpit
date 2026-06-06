import { readFile, statfs } from 'node:fs/promises';
import { execFile } from 'node:child_process';

// Coletor de telemetria da máquina (CPU/RAM/GPU/disco) em tempo real.
// Lê /proc direto (sem deps) e nvidia-smi quando há GPU. Tudo best-effort:
// qualquer leitura que falhe vira null/0, nunca derruba o broadcast.

export interface Stats {
  cpu: number;                 // 0..100 (% de uso agregado)
  mem: { used: number; total: number };       // bytes
  gpu: { util: number; memUsed: number; memTotal: number } | null; // % / bytes
  disk: { used: number; total: number };       // bytes (filesystem do HOME)
  load: number;                // load average 1min
  saturated?: { cpu: boolean; mem: boolean; seconds: number }; // watchdog (#103), preenchido no loop de ws
}

let prevCpu: { total: number; idle: number } | null = null;

async function readCpu(): Promise<number> {
  const raw = await readFile('/proc/stat', 'utf8').catch(() => '');
  const line = raw.split('\n').find((l) => l.startsWith('cpu '));
  if (!line) return 0;
  const n = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (n[3] ?? 0) + (n[4] ?? 0);            // idle + iowait
  const total = n.reduce((a, b) => a + (b || 0), 0);
  const prev = prevCpu;
  prevCpu = { total, idle };
  if (!prev) return 0;
  const dt = total - prev.total;
  const di = idle - prev.idle;
  if (dt <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - di / dt) * 100));
}

async function readMem(): Promise<{ used: number; total: number }> {
  const raw = await readFile('/proc/meminfo', 'utf8').catch(() => '');
  const kb = (key: string) => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(raw);
    return m ? Number(m[1]) * 1024 : 0;
  };
  const total = kb('MemTotal');
  const avail = kb('MemAvailable');
  return { used: Math.max(0, total - avail), total };
}

async function readLoad(): Promise<number> {
  const raw = await readFile('/proc/loadavg', 'utf8').catch(() => '');
  return Number(raw.split(/\s+/)[0]) || 0;
}

let gpuAvailable: boolean | null = null; // null=desconhecido, false=ausente (não retenta)

function readGpu(): Promise<Stats['gpu']> {
  if (gpuAvailable === false) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 1500 },
      (err, stdout) => {
        if (err) { gpuAvailable = false; resolve(null); return; }
        gpuAvailable = true;
        const [util, used, total] = stdout.trim().split('\n')[0].split(',').map((s) => Number(s.trim()));
        if (!Number.isFinite(util)) { resolve(null); return; }
        const MiB = 1024 * 1024;
        resolve({ util, memUsed: (used || 0) * MiB, memTotal: (total || 0) * MiB });
      },
    );
  });
}

async function readDisk(): Promise<{ used: number; total: number }> {
  const fs = await statfs(process.env.HOME ?? '/').catch(() => null);
  if (!fs) return { used: 0, total: 0 };
  const bs = Number(fs.bsize) || 0;
  const total = Number(fs.blocks) * bs;
  const free = Number(fs.bfree) * bs;
  return { used: Math.max(0, total - free), total };
}

export async function collect(): Promise<Stats> {
  const [cpu, mem, gpu, disk, load] = await Promise.all([readCpu(), readMem(), readGpu(), readDisk(), readLoad()]);
  return { cpu, mem, gpu, disk, load };
}
