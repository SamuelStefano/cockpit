import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Icon, tokens } from '../primitives';
import { useDismiss } from './useDismiss';

// Bottom sheet for the narrow layout. Portaled like PickerSheet: the composer's
// `backdrop-blur` becomes the containing block for `fixed`, and an `inset-0`
// backdrop would only cover the composer box, not the thread.
export function ComposerSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useDismiss<HTMLDivElement>(true, onClose);
  const sheet = (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-label="Ajustes do próximo prompt"
        className="fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-t-2xl border border-neutral-700 bg-neutral-900 pb-[env(safe-area-inset-bottom)] shadow-xl shadow-black/50"
      >
        <div className="flex items-center justify-end px-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet;
}
