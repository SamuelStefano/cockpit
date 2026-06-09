import { useEffect } from 'react';
import { setTitleBase } from '../lib/notify';

// Reflete atividade no título da aba (visível com a aba em background no run
// noturno): "▶N" rodando, "●N" com output novo não visto.
export function useTabTitle(running: Set<string>, updated: Set<string>) {
  useEffect(() => {
    const parts: string[] = [];
    if (running.size) parts.push(`▶${running.size}`);
    if (updated.size) parts.push(`●${updated.size}`);
    setTitleBase((parts.length ? parts.join(' ') + ' — ' : '') + 'Deck');
  }, [running, updated]);
}
