import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { escapeLayerOpen } from './useEscapeLayer';
import { tokens } from './tokens';

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type PopoverAlign = 'start' | 'end';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  // The element that opens it; clicks on it do not count as "outside".
  children: ReactNode;
  content: ReactNode;
  side?: PopoverSide;
  align?: PopoverAlign;
  label: string;
  className?: string;
}

const GAP = 8;
const MARGIN = 8;

// Anchored with `position: fixed` from the trigger rect so a scrolling or
// overflow-hidden ancestor (a sidebar rail) never clips it.
function panelStyle(r: DOMRect, side: PopoverSide, align: PopoverAlign): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s: CSSProperties = {};
  if (side === 'top' || side === 'bottom') {
    if (side === 'top') s.bottom = vh - r.top + GAP; else s.top = r.bottom + GAP;
    if (align === 'start') s.left = Math.max(MARGIN, r.left); else s.right = Math.max(MARGIN, vw - r.right);
    s.maxHeight = side === 'top' ? r.top - GAP - MARGIN : vh - r.bottom - GAP - MARGIN;
  } else {
    if (side === 'left') s.right = vw - r.left + GAP; else s.left = r.right + GAP;
    if (align === 'start') s.top = Math.max(MARGIN, r.top); else s.bottom = Math.max(MARGIN, vh - r.bottom);
    s.maxHeight = align === 'start' ? vh - r.top - MARGIN : r.bottom - MARGIN;
  }
  s.maxWidth = `calc(100vw - ${MARGIN * 2}px)`;
  return s;
}

export function Popover({ open, onClose, children, content, side = 'bottom', align = 'start', label, className = '' }: PopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setStyle(null); return; }
    const place = () => { if (anchorRef.current) setStyle(panelStyle(anchorRef.current.getBoundingClientRect(), side, align)); };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, side, align]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      closeRef.current();
    };
    // One Esc closes one overlay: a modal opened on top gets it first.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || escapeLayerOpen()) return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('pointerdown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <>
      <span ref={anchorRef} className="inline-flex">{children}</span>
      {open && style && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          style={style}
          className={`pop-spring scroll-thin fixed z-70 overflow-y-auto ${tokens.radius.lg} ${tokens.surface.raised} ${className}`}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
