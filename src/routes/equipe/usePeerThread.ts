import { useMemo } from 'react';
import { betweenPair, type TeamMessage } from '../../../shared/team-messages';

export function usePeerThread(log: TeamMessage[], a: string, b: string): TeamMessage[] {
  return useMemo(() => log.filter((m) => betweenPair(m, a, b)), [log, a, b]);
}
