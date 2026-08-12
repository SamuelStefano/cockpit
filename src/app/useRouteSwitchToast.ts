import { useEffect } from 'react';
import { toast } from '../components/primitives';
import type { RouteSwitchNotice } from '../useCockpit';

// A troca de provedor acontece sozinha no meio do turno; sem um aviso ativo o
// usuário só descobriria olhando o Admin — ou pelo estilo diferente da resposta.
export function useRouteSwitchToast(notice: RouteSwitchNotice | null, onDismiss: () => void) {
  useEffect(() => {
    if (!notice) return;
    toast(`Trocou para ${notice.label} — ${notice.reason}`);
    onDismiss();
  }, [notice, onDismiss]);
}
