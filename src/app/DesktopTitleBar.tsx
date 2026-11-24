import type { CSSProperties } from 'react';
import { boxLabel } from '../cockpit/boxes-store';
import { useBoxes } from '../cockpit/useBoxes';
import { hasCustomTitlebar } from '../lib/desktop';

// Room for the window buttons the shell draws over the page (titleBarOverlay).
const DRAG = { WebkitAppRegion: 'drag', paddingRight: 140 } as CSSProperties;

export function DesktopTitleBar() {
  const { boxes, active } = useBoxes();
  if (!hasCustomTitlebar()) return null;
  const box = boxes.find((b) => b.id === active);
  return (
    <div style={DRAG} className="flex h-8 shrink-0 select-none items-center gap-2 border-b border-neutral-800 bg-neutral-950 pl-3 text-[12px] text-neutral-500">
      <span className="font-display font-bold lowercase tracking-wide text-neutral-300">deck</span>
      {box && <span className="truncate">{boxLabel(box)}</span>}
    </div>
  );
}
