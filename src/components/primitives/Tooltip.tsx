import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  label: ReactNode;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: TooltipSide;
  delay?: number;
  disabled?: boolean;
}

const GAP = 8;

function bubbleStyle(r: DOMRect, side: TooltipSide): React.CSSProperties {
  if (side === 'top') return { left: r.left + r.width / 2, top: r.top - GAP, transform: 'translate(-50%, -100%)' };
  if (side === 'bottom') return { left: r.left + r.width / 2, top: r.bottom + GAP, transform: 'translateX(-50%)' };
  if (side === 'left') return { left: r.left - GAP, top: r.top + r.height / 2, transform: 'translate(-100%, -50%)' };
  return { left: r.right + GAP, top: r.top + r.height / 2, transform: 'translateY(-50%)' };
}

// Hover/focus label. Touch never shows it (no hover, and a long-press tooltip
// would fight the context menu), so anything essential must also be in the
// trigger's aria-label.
export function Tooltip({ label, children, side = 'top', delay = 350, disabled = false }: TooltipProps) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const show = useCallback((immediate: boolean) => {
    window.clearTimeout(timer.current);
    const open = () => { if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect()); };
    if (immediate) open();
    else timer.current = window.setTimeout(open, delay);
  }, [delay]);
  const hide = useCallback(() => { window.clearTimeout(timer.current); setRect(null); }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!rect) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRect(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('scroll', hide, true); };
  }, [rect, hide]);

  const visible = !!rect && !disabled && !!label;
  const trigger = visible && isValidElement(children) ? cloneElement(children, { 'aria-describedby': id }) : children;
  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') show(false); }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => { if (e.target.matches(':focus-visible')) show(true); }}
      onBlur={hide}
    >
      {trigger}
      {visible && rect && createPortal(
        <span
          id={id}
          role="tooltip"
          style={bubbleStyle(rect, side)}
          className="pointer-events-none fixed z-80 max-w-64 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200 shadow-xl"
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
