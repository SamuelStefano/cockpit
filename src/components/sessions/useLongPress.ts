import { useRef, useState } from 'react';

// Mobile: segurar o dedo (long-press) abre o menu de ações, sem precisar mirar no
// grip. O timer dispara em 450ms; um toque curto só seleciona a sessão. consumeTap
// devolve true quando o clique que segue um long-press deve ser ignorado.
export function useLongPress(onLongPress: () => void, delay = 450) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const [open, setOpen] = useState(false);

  const clear = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const onTouchStart = () => {
    longPressed.current = false;
    clear();
    pressTimer.current = setTimeout(() => { longPressed.current = true; setOpen(true); onLongPress(); }, delay);
  };
  const consumeTap = () => {
    if (!longPressed.current) return false;
    longPressed.current = false;
    return true;
  };

  return {
    open,
    setOpen,
    consumeTap,
    handlers: { onTouchStart, onTouchMove: clear, onTouchEnd: clear, onTouchCancel: clear },
  };
}
