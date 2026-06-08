// Recall de histórico estilo shell no composer: ↑ no campo vazio puxa o último
// prompt; ↑/↓ navegam; ↓ além do fim limpa. A matemática de índice (null→cauda,
// clamp no topo, sair pro fim) é exatamente onde um off-by-one quebra calado —
// por isso vive aqui, pura e testável, fora do handler de teclado.

export interface RecallState {
  histIdx: number | null;
  value: string;
}

// Próximo estado de recall pra um ↑/↓, ou null pra deixar a tecla cair no
// comportamento normal do cursor (campo não-vazio sem recall, ou ↓ sem recall).
export function nextRecall(
  history: string[],
  histIdx: number | null,
  value: string,
  dir: 'up' | 'down',
): RecallState | null {
  if (!history.length) return null;
  // Índice preso a um histórico ANTERIOR (troca de sessão encolhe o array): trata
  // como sem-recall pra reiniciar pela cauda do histórico atual, não indexar fora.
  const active = histIdx !== null && histIdx < history.length ? histIdx : null;
  if (dir === 'up') {
    if (active === null) {
      if (value !== '' && histIdx === null) return null; // ↑ num campo digitado = cursor normal
      const last = history.length - 1;
      return { histIdx: last, value: history[last] };
    }
    const idx = Math.max(0, active - 1);
    return { histIdx: idx, value: history[idx] };
  }
  if (active === null) return null; // ↓ sem recall ativo (ou índice obsoleto) = cursor normal
  const next = active + 1;
  if (next >= history.length) return { histIdx: null, value: '' };
  return { histIdx: next, value: history[next] };
}
