import { useRef, type ReactNode } from 'react';
import { useEscapeLayer } from './useEscapeLayer';
import { useDialogFocus } from './useDialogFocus';
import { Button } from './Button';
import { tokens } from './tokens';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'left' | 'right';
  width?: string;
}

// Side sheet for small screens: what is a fixed side pane on desktop (a
// navigator, a filter list) slides in over the content on a phone.
export function Drawer({ open, onClose, title, children, side = 'left', width = 'w-[86vw] max-w-sm' }: DrawerProps) {
  useEscapeLayer(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Read during render, before an autoFocus child takes focus in the commit.
  if (!open) opener.current = null;
  else if (!opener.current && typeof document !== 'undefined') opener.current = document.activeElement;
  useDialogFocus(ref, open, opener);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 flex bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`flex h-full ${width} flex-col border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/60 ${side === 'left' ? 'border-r' : 'ml-auto border-l'}`}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 px-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-200">{title}</span>
          <Button variant="ghost" size="sm" square icon="x" onClick={onClose} title="Fechar (Esc)" aria-label="Fechar" className={tokens.touchTarget} />
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
