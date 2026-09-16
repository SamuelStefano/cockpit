// Recall de histórico estilo shell no composer: ↑ no campo vazio puxa o último
// prompt; ↑/↓ navegam; ↓ além do fim limpa. A matemática de índice (null→cauda,
// clamp no topo, sair pro fim) é exatamente onde um off-by-one quebra calado —
// por isso vive aqui, pura e testável, fora do handler de teclado.

export interface RecallState {
  histIdx: number | null;
  value: string;
}

export interface Caret {
  start: number;
  end: number;
}

// Numa composição de VÁRIAS linhas a seta tem que mover o cursor entre as linhas,
// não trocar a entrada do histórico. Só a primeira linha (↑) e a última (↓) caem
// no recall — a mesma regra do shell. Seleção viva (start !== end) sempre deixa a
// tecla passar: é ⇧+seta estendendo seleção.
export function caretAllowsRecall(value: string, caret: Caret | null, dir: 'up' | 'down'): boolean {
  if (!caret) return true; // sem cursor conhecido (ex: seta injetada como texto)
  if (caret.start !== caret.end) return false;
  return dir === 'up'
    ? !value.slice(0, caret.start).includes('\n')
    : !value.slice(caret.end).includes('\n');
}

// Próximo estado de recall pra um ↑/↓, ou null pra deixar a tecla cair no
// comportamento normal do cursor (campo não-vazio sem recall, ou ↓ sem recall).
export function nextRecall(
  history: string[],
  histIdx: number | null,
  value: string,
  dir: 'up' | 'down',
  caret: Caret | null = null,
): RecallState | null {
  if (!history.length) return null;
  if (!caretAllowsRecall(value, caret, dir)) return null;
  // Índice preso a um histórico ANTERIOR (troca de sessão encolhe o array): trata
  // como sem-recall pra reiniciar pela cauda do histórico atual, não indexar fora.
  const active = histIdx !== null && histIdx < history.length ? histIdx : null;
  if (dir === 'up') {
    if (active === null) {
      // ↑ num campo digitado = cursor normal. Vale TAMBÉM com índice obsoleto
      // (trocar de sessão preserva o histIdx velho): aqui o value é o rascunho
      // da sessão nova — recallar por cima apagaria texto do usuário.
      if (value !== '') return null;
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
