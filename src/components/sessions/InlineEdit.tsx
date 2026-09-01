import { useCallback } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

interface InlineEditProps {
  value: string;
  onChange: (v: string) => void;
  // Também roda no blur: sair do campo salva, igual a dar Enter.
  onCommit: () => void;
  onCancel: () => void;
  label: string;
  className?: string;
  placeholder?: string;
  // Textarea: Enter puro quebra linha, então o commit sobe pro Cmd/Ctrl+Enter.
  multiline?: boolean;
  rows?: number;
}

// Campo de edição in-place do card de sessão (título, descrição, etiqueta). Os três
// repetiam o mesmo par de invariantes fáceis de esquecer numa cópia nova: a guarda
// de `isComposing` (sem ela o Enter que confirma o IME japonês/coreano salvava o
// texto pela metade) e o `stopPropagation` no clique.
export function InlineEdit({ value, onChange, onCommit, onCancel, label, className = '', placeholder, multiline = false, rows }: InlineEditProps) {
  // Ref-callback em vez de efeito: o campo só monta quando a edição abre, então
  // focar e selecionar aqui já deixa o texto pronto pra sobrescrever.
  const focusOnMount = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    el?.focus();
    el?.select();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
    if (e.key !== 'Enter') return;
    if (multiline && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    onCommit();
  };

  const common = {
    value,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur: onCommit,
    onKeyDown,
    // O card inteiro é role="button": sem barrar aqui, clicar pra posicionar o
    // cursor no meio do texto trocava a sessão ativa.
    onClick: (e: MouseEvent) => e.stopPropagation(),
    placeholder,
    'aria-label': label,
    className,
  };

  return multiline
    ? <textarea ref={focusOnMount} rows={rows} {...common} />
    : <input ref={focusOnMount} {...common} />;
}
