import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Popover, type PopoverAlign, type PopoverSide } from './Popover';
import { escapeLayerOpen } from './useEscapeLayer';
import { useCoarse } from './useCoarse';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  content: ReactNode;
  // Desktop trigger; ignored on touch where the sheet slides from the bottom.
  children: ReactNode;
  side?: PopoverSide;
  align?: PopoverAlign;
  className?: string;
}

function BottomSheet({ onClose, label, content }: Pick<SheetProps, 'onClose' | 'label' | 'content'>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || escapeLayerOpen()) return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-70">
      <div data-testid="sheet-scrim" onPointerDown={onClose} className="sheet-scrim absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="sheet-panel scroll-thin absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[18px] border border-b-0 border-neutral-700 bg-neutral-950 px-2.5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5 elev-2"
      >
        <div className="mx-auto mb-2.5 h-1 w-9 rounded-xs bg-neutral-700" />
        {content}
      </div>
    </div>,
    document.body,
  );
}

export function Sheet({ open, onClose, label, content, children, side = 'bottom', align = 'start', className }: SheetProps) {
  const coarse = useCoarse();
  if (coarse) {
    return (
      <>
        <span className="inline-flex">{children}</span>
        {open && <BottomSheet onClose={onClose} label={label} content={content} />}
      </>
    );
  }
  return <Popover open={open} onClose={onClose} label={label} content={content} side={side} align={align} className={className}>{children}</Popover>;
}
