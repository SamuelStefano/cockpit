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

export function useTabTitle(running: Set<string>, updated: Set<string>) {
  useEffect(() => {
    setTitleBase(tabTitle(running.size, updated.size));
    // Só o "não visto" vira badge: "rodando" já não é novidade pra quem disparou,
    // e um contador que nunca zera perde o sentido no ícone do app instalado.
    setBadge(updated.size);
  }, [running, updated]);
}
