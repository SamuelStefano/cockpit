import { useCallback, useState } from 'react';
import { usePersisted } from '../../lib/persist';
import { saturation, canHandoff, type Saturation } from './saturation';

type Level = 'warn' | 'critical';

export interface SaturationNotice {
  sat: Saturation;
  level: Level;
  expanded: boolean;
  toggle: () => void;
  dismiss: () => void;
}

// Dispensa por sessão E por nível: quem fechou no amarelo volta a ver quando a
// janela entra no vermelho — aí migrar deixou de ser sugestão e virou economia.
export function useSaturationBanner(sessionId: string | undefined, contextTokens: number): SaturationNotice | null {
  const [dismissed, setDismissed] = usePersisted<Record<string, Level>>('satDismissed', {});
  const [expanded, setExpanded] = useState(false);

  const sat = saturation(contextTokens);
  const level: Level | null = sat ? (sat.critical ? 'critical' : 'warn') : null;

  const dismiss = useCallback(() => {
    if (!sessionId || !level) return;
    setExpanded(false);
    setDismissed((d) => ({ ...d, [sessionId]: level }));
  }, [sessionId, level, setDismissed]);

  const toggle = useCallback(() => setExpanded((e) => !e), []);

  if (!sat || !level || !canHandoff(sessionId, false)) return null;
  const seen = dismissed[sessionId!];
  if (seen === level || (seen === 'critical' && level === 'warn')) return null;

  return { sat, level, expanded, toggle, dismiss };
}
