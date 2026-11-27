import type { TeamBot } from '../../../shared/protocol';

export interface SourceStatus { tone: 'neutral' | 'green' | 'red'; text: string }

export function sourceStatus(bot: Pick<TeamBot, 'source' | 'sourceSync'> | null): SourceStatus | null {
  if (!bot?.source) return null;
  const s = bot.sourceSync;
  if (!s) return { tone: 'neutral', text: 'sincronizando…' };
  if (s.error) return { tone: 'red', text: s.error };
  const at = new Date(s.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return { tone: 'green', text: `main ${s.commit ?? ''} · ${at}`.replace('  ', ' ') };
}
