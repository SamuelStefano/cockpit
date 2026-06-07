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

type CpuSample = { total: number; idle: number };
let prevCpu: CpuSample | null = null;

// Pura e testável: deriva % de uso de /proc/stat dado o snapshot anterior. O
// primeiro tick (prev=null) não tem delta → 0. Retorna o novo snapshot pro
// caller persistir, em vez de esconder o estado aqui dentro.
export function parseCpu(raw: string, prev: CpuSample | null): { cpu: number; sample: CpuSample | null } {
  const line = raw.split('\n').find((l) => l.startsWith('cpu '));
  if (!line) return { cpu: 0, sample: prev };
  const n = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (n[3] ?? 0) + (n[4] ?? 0);            // idle + iowait
  const total = n.reduce((a, b) => a + (b || 0), 0);
  const sample = { total, idle };
  if (!prev) return { cpu: 0, sample };
  const dt = total - prev.total;
  const di = idle - prev.idle;
  if (dt <= 0) return { cpu: 0, sample };
  return { cpu: Math.max(0, Math.min(100, (1 - di / dt) * 100)), sample };
}

async function readCpu(): Promise<number> {
  const raw = await readFile('/proc/stat', 'utf8').catch(() => '');
  const { cpu, sample } = parseCpu(raw, prevCpu);
  prevCpu = sample;
  return cpu;
}

// Pura: extrai used/total de /proc/meminfo (used = MemTotal - MemAvailable).
export function parseMem(raw: string): { used: number; total: number } {
  const kb = (key: string) => {
    const m = new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(raw);
    return m ? Number(m[1]) * 1024 : 0;
  };
  const total = kb('MemTotal');
  const avail = kb('MemAvailable');
  return { used: Math.max(0, total - avail), total };
}

async function readMem(): Promise<{ used: number; total: number }> {
  return parseMem(await readFile('/proc/meminfo', 'utf8').catch(() => ''));
}

// Pura: load average de 1min (primeiro campo de /proc/loadavg).
export function parseLoad(raw: string): number {
  return Number(raw.split(/\s+/)[0]) || 0;
}

async function readLoad(): Promise<number> {
  return parseLoad(await readFile('/proc/loadavg', 'utf8').catch(() => ''));
}

let gpuAvailable: boolean | null = null; // null=desconhecido, false=ausente (não retenta)

// Pura: parseia a 1ª linha CSV do nvidia-smi (util, memUsed MiB, memTotal MiB).
// util não-numérico (header inesperado, GPU sem suporte) → null.
export function parseGpu(stdout: string): Stats['gpu'] {
  const [util, used, total] = stdout.trim().split('\n')[0].split(',').map((s) => Number(s.trim()));
  if (!Number.isFinite(util)) return null;
  const MiB = 1024 * 1024;
  return { util, memUsed: (used || 0) * MiB, memTotal: (total || 0) * MiB };
}

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
        resolve(parseGpu(stdout));
      },
    );
  });
}

// Pura: bytes usados/totais a partir do statfs (blocos * tamanho de bloco).
export function parseDisk(fs: { bsize: number | bigint; blocks: number | bigint; bfree: number | bigint } | null): { used: number; total: number } {
  if (!fs) return { used: 0, total: 0 };
  const bs = Number(fs.bsize) || 0;
  const total = Number(fs.blocks) * bs;
  const free = Number(fs.bfree) * bs;
  return { used: Math.max(0, total - free), total };
}

async function readDisk(): Promise<{ used: number; total: number }> {
  return parseDisk(await statfs(process.env.HOME ?? '/').catch(() => null));
}

export async function collect(): Promise<Stats> {
  const [cpu, mem, gpu, disk, load] = await Promise.all([readCpu(), readMem(), readGpu(), readDisk(), readLoad()]);
  return { cpu, mem, gpu, disk, load };
}
