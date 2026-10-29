import { createPortal } from 'react-dom';
import { useRef, type ReactNode } from 'react';
import { useBackClose } from './primitives/useBackClose';
import { isCloseSwipe, type SwipePoint } from './primitives/swipe';

interface MobileDrawerProps {
  onClose: () => void;
  children: ReactNode;
}

// Portaled to <body>, outside the app root: the root is a padded, dvh-sized flex
// column, and on iOS Safari a `fixed` child of it can end up painted under the
// header's own layers. At body level the drawer always wins, and its top padding
// keeps the first row clear of the notch.
export function MobileDrawer({ onClose, children }: MobileDrawerProps) {
  useBackClose(true, onClose);
  const start = useRef<SwipePoint | null>(null);
  return createPortal(
    <div className="fixed inset-0 z-60">
      <div className="absolute inset-0 bg-black/55" style={{ animation: 'overlayIn 0.2s ease' }} onClick={onClose} />
      <div
        onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => { const t = e.changedTouches[0]; if (start.current && isCloseSwipe(start.current, { x: t.clientX, y: t.clientY })) onClose(); start.current = null; }}
        className="absolute inset-y-0 left-0 w-[300px] max-w-[88%] max-lg:w-[calc(100%-56px)] max-lg:max-w-[340px] border-r border-neutral-800 bg-neutral-950 shadow-2xl"
        style={{ animation: 'drawerIn 0.26s cubic-bezier(0.22,1,0.36,1)', paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
