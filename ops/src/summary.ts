import type { DiagReport } from './data.ts';

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const short = (v: unknown, n: number) => String(v).replace(/\s+/g, ' ').trim().slice(0, n);

// One line that says what went wrong, from fields the Deck and the agent write.
export function summarize(r: Pick<DiagReport, 'source' | 'payload'>): string {
  const p = obj(r.payload) ?? {};
  if (Array.isArray(p.lines)) {
    const lines = p.lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '');
    const bad = [...lines].reverse().find((l) => /error|fail|exception|fatal|panic/i.test(l));
    const line = bad ?? lines[lines.length - 1];
    return line ? short(line, 200) : 'sem linhas';
  }
  const parts: string[] = [];
  if (typeof p.cause === 'string') parts.push(`causa ${p.cause}`);
  const close = obj(p.lastClose);
  if (close && close.code !== undefined) parts.push(`close ${short(close.code, 10)}${close.reason ? ` (${short(close.reason, 60)})` : ''}`);
  if (typeof p.seal === 'string') parts.push(`seal ${p.seal}`);
  if (typeof p.conn === 'string') parts.push(`conn ${p.conn}`);
  const extra = obj(p.extra);
  if (extra && typeof extra.message === 'string') parts.push(short(extra.message, 120));
  return parts.length ? parts.join(' · ').slice(0, 300) : 'sem resumo';
}
