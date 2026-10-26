import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tokens } from '../../components/primitives';

interface SelectionQuoteProps {
  onQuote: (text: string) => void;
  children: ReactNode;
}

export function SelectionQuote({ onQuote, children }: SelectionQuoteProps) {
  const host = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const read = () => {
      const s = document.getSelection();
      const text = s?.toString().trim() ?? '';
      if (!text || !s || s.rangeCount === 0) { setSel(null); return; }
      const range = s.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el = node instanceof Element ? node : node.parentElement;
      if (!host.current || !el || !host.current.contains(el) || el.closest('textarea, input, [contenteditable]')) {
        setSel(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const box = host.current.getBoundingClientRect();
      setSel({ text, x: r.left + r.width / 2 - box.left, y: r.top - box.top });
    };
    document.addEventListener('mouseup', read);
    document.addEventListener('keyup', read);
    return () => {
      document.removeEventListener('mouseup', read);
      document.removeEventListener('keyup', read);
    };
  }, []);

  return (
    <div ref={host} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {children}
      {sel && (
        <button
          type="button"
          className={`absolute z-20 rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-neutral-100 shadow-lg ${tokens.focusRing}`}
          style={{ left: sel.x, top: Math.max(8, sel.y - 8), transform: 'translate(-50%, -100%)' }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onQuote(sel.text); setSel(null); }}
        >
          Adicionar ao chat
        </button>
      )}
    </div>
  );
}
