const MAX_LINES = 2000;

type Op = { t: ' ' | '-' | '+'; line: string };

function lines(s: string): string[] {
  if (!s) return [];
  const out = s.split('\n');
  if (out[out.length - 1] === '') out.pop();
  return out;
}

function lcsOps(a: string[], b: string[]): Op[] {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const ops: Op[] = a.slice(0, head).map((line) => ({ t: ' ', line }));
  if (midA.length > MAX_LINES || midB.length > MAX_LINES) {
    for (const line of midA) ops.push({ t: '-', line });
    for (const line of midB) ops.push({ t: '+', line });
  } else {
    const w = midB.length + 1;
    const dp = new Uint32Array((midA.length + 1) * w);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        dp[i * w + j] = midA[i] === midB[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) { ops.push({ t: ' ', line: midA[i] }); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) { ops.push({ t: '-', line: midA[i] }); i++; }
      else { ops.push({ t: '+', line: midB[j] }); j++; }
    }
    for (; i < midA.length; i++) ops.push({ t: '-', line: midA[i] });
    for (; j < midB.length; j++) ops.push({ t: '+', line: midB[j] });
  }
  for (const line of a.slice(a.length - tail)) ops.push({ t: ' ', line });
  return ops;
}

export function unifiedDiff(before: string, after: string, labelBefore = 'antes', labelAfter = 'depois', context = 3): string {
  const ops = lcsOps(lines(before), lines(after));
  if (!ops.some((o) => o.t !== ' ')) return '';
  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((o, i) => {
    if (o.t === ' ') return;
    for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
  });
  const out = [`--- ${labelBefore}`, `+++ ${labelAfter}`];
  let oldNo = 1;
  let newNo = 1;
  let i = 0;
  while (i < ops.length) {
    if (!keep[i]) {
      if (ops[i].t !== '+') oldNo++;
      if (ops[i].t !== '-') newNo++;
      i++;
      continue;
    }
    let end = i;
    while (end < ops.length && keep[end]) end++;
    const hunk = ops.slice(i, end);
    const oldLen = hunk.filter((o) => o.t !== '+').length;
    const newLen = hunk.filter((o) => o.t !== '-').length;
    out.push(`@@ -${oldLen ? oldNo : oldNo - 1},${oldLen} +${newLen ? newNo : newNo - 1},${newLen} @@`);
    for (const o of hunk) out.push(o.t + o.line);
    oldNo += oldLen;
    newNo += newLen;
    i = end;
  }
  return out.join('\n');
}
