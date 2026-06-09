import { useState, type RefObject } from 'react';
import { fitHeight } from './fit-height';

// Recall estilo shell: ↑ no campo vazio puxa o último prompt enviado; ↑/↓
// navegam o histórico; ↓ abaixo do fim limpa. Histórico = msgs do usuário.
export function useComposerRecall(history: string[], setValue: (v: string) => void, taRef: RefObject<HTMLTextAreaElement>) {
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const recall = (idx: number) => {
    setHistIdx(idx);
    setValue(history[idx]);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.setSelectionRange(el.value.length, el.value.length);
      fitHeight(el);
    });
  };
  return { histIdx, setHistIdx, recall };
}
