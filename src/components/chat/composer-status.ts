import { contextMeter } from './toolbar-format';

export type ContextTone = 'ok' | 'warn' | 'err';

export interface ComposerStatus {
  context: { pct: number; tone: ContextTone } | null;
  queued: number;
}

export function composerStatus(contextTokens: number, contextModel: string | null | undefined, queued: number): ComposerStatus | null {
  const meter = contextMeter(contextTokens, contextModel);
  const context = meter ? { pct: meter.pct, tone: (meter.high ? 'err' : meter.mid ? 'warn' : 'ok') as ContextTone } : null;
  if (!context && queued <= 0) return null;
  return { context, queued: Math.max(0, queued) };
}
