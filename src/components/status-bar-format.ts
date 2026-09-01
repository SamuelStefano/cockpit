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
