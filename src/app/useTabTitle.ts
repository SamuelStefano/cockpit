import { useEffect } from 'react';
import { setTitleBase, setBadge } from '../lib/notify';

// Reflete atividade no título da aba (visível com a aba em background no run
// noturno): "▶N" rodando, "●N" com output novo não visto.
export function tabTitle(running: number, updated: number): string {
  const parts: string[] = [];
  if (running) parts.push(`▶${running}`);
  if (updated) parts.push(`●${updated}`);
  return (parts.length ? parts.join(' ') + ' — ' : '') + 'Deck';
}

export function useTabTitle(running: Set<string>, updated: Set<string>, redCount: number) {
  useEffect(() => {
    setTitleBase(tabTitle(running.size, updated.size));
    // The badge is what needs the person, across every box. "Finished" is a dot on
    // the rail: a counter that rarely reaches zero stops meaning anything.
    setBadge(redCount);
  }, [running, updated, redCount]);
}
