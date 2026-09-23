import { DEFAULT_CONTEXT_WINDOW, LONG_CONTEXT_WINDOW, contextWindowFor } from '../../../shared/context-window';
import type { TermStats } from '../../../shared/canvas';

// The transcript records the model without its `[1m]` tag, so a session past
// 200k can only be running the long window — reading it as 200k would pin
// every big session at a misleading 100%.
export function ctxWindow(tokens: number, model?: string): number {
  return tokens > DEFAULT_CONTEXT_WINDOW ? LONG_CONTEXT_WINDOW : contextWindowFor(model);
}

export function ctxPct(s: Pick<TermStats, 'contextTokens' | 'model'>): number | null {
  if (!s.contextTokens) return null;
  return Math.min(100, Math.round((s.contextTokens / ctxWindow(s.contextTokens, s.model)) * 100));
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb}MB`;
}

export type Heat = 'ok' | 'warn' | 'hot';
export const cpuHeat = (cpu: number): Heat => (cpu >= 80 ? 'hot' : cpu >= 30 ? 'warn' : 'ok');
export const ctxHeat = (pct: number): Heat => (pct >= 80 ? 'hot' : pct >= 55 ? 'warn' : 'ok');
export const HEAT_TEXT: Record<Heat, string> = { ok: 'text-green-400', warn: 'text-yellow-400', hot: 'text-red-400' };

export function shortModel(model?: string): string {
  return model ? model.replace(/^claude-/, '').replace(/-\d{8}$/, '') : '';
}
