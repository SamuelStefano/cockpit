import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useBackClose } from '../../primitives/useBackClose';
import { useEscapeLayer } from '../../primitives/useEscapeLayer';

// The phone sheet is a modal layer: Esc and the back gesture close it. The
// desktop column is not: Esc closes it only while focus is inside, so the
// composer's own Esc (stop the turn, close a menu) keeps its meaning.
export function useFilePanelDismiss(fullScreen: boolean, onClose: () => void, openKey: string) {
  const ref = useRef<HTMLElement>(null);
  useEscapeLayer(fullScreen, onClose);
  useBackClose(fullScreen, onClose);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, [openKey]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (fullScreen || e.key !== 'Escape' || e.defaultPrevented || e.nativeEvent.isComposing) return;
    e.preventDefault();
    onClose();
  };
  return { ref, onKeyDown };
}
