import { relAge, relReset } from '../../../lib/time';
import { isOldReading, isStalePlanUsage, toneOf } from '../usage-rows';
import type { RingTone } from '../../primitives';
import type { PlanUsage } from '../../../../shared/protocol';
import type { UsageAgent } from '../usage-agent';

interface UsageSummaryInput {
  usage: PlanUsage | null;
  agent: UsageAgent;
  readAt?: number | null;
  warn?: boolean;
  paused?: boolean;
  quotaResetsAt?: number | null;
}

export interface UsageSummary {
  pct: number | null;
  tone: RingTone;
  // Accessible name of the ring button.
  aria: string;
  // Hover text: the percentage and reset the old bar printed.
  tip: string;
}

export function usageSummary({ usage, agent, readAt = null, warn = false, paused = false, quotaResetsAt = null }: UsageSummaryInput): UsageSummary {
  const what = agent === 'grok' ? 'Uso do Grok' : 'Uso do plano';
  const stale = isStalePlanUsage(usage);
  const old = isOldReading(readAt);
  const pct = usage && !stale ? usage.fiveHour : null;
  const tone: RingTone = pct === null || old ? 'idle' : toneOf(pct);
  const gateReset = quotaResetsAt ? relReset(quotaResetsAt) : '';
  const reset = usage?.resetsAt && !stale && !old ? relReset(usage.resetsAt) : '';
  const age = old && readAt ? relAge(readAt) : '';

  const aria = `${what}: ${pct === null ? 'lendo' : `${pct}%`}${paused ? ' — cota esgotada' : warn ? ' — perto do limite' : ''}${gateReset ? `, reseta ${gateReset}` : ''}`;
  const parts = [pct === null ? `${what}: ${stale ? 'janela virou, número novo a caminho' : 'lendo da conta…'}` : `${what}: ${pct}%`];
  if (reset) parts.push(`reseta em ${reset}`);
  if (age) parts.push(`lido há ${age}`);
  if (paused) parts.unshift('Cota esgotada');
  else if (warn) parts.unshift('Perto do limite');
  return { pct, tone, aria, tip: parts.join(' · ') };
}
