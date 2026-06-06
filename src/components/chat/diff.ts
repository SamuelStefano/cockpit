export type DiffRow = { t: 'ctx' | 'add' | 'del'; s: string };

// LCS de linhas pra um diff interleaved. O(n*m) — limitado a trechos pequenos
// (Edit/Write costumam ser curtos); acima do teto cai pro before/after simples.
export function lineDiff(oldText: string, newText: string): DiffRow[] {
  const a = oldText === '' ? [] : oldText.split('\n');
  const b = newText === '' ? [] : newText.split('\n');
  if (a.length === 0) return b.map((s) => ({ t: 'add' as const, s }));
  if (b.length === 0) return a.map((s) => ({ t: 'del' as const, s }));
  if (a.length > 300 || b.length > 300) {
    return [...a.map((s) => ({ t: 'del' as const, s })), ...b.map((s) => ({ t: 'add' as const, s }))];
  }
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'ctx', s: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: 'del', s: a[i] }); i++; }
    else { out.push({ t: 'add', s: b[j] }); j++; }
  }
  while (i < n) out.push({ t: 'del', s: a[i++] });
  while (j < m) out.push({ t: 'add', s: b[j++] });
  return out;
}
