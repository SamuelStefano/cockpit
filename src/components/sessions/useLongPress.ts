import { useRef, useState } from 'react';

// Mobile: segurar o dedo (long-press) abre o menu de ações, sem precisar mirar no
// grip. O timer dispara em 450ms; um toque curto só seleciona a sessão. consumeTap
// devolve true quando o clique que segue um long-press deve ser ignorado.
export function useLongPress(onLongPress: () => void, delay = 450) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const [open, setOpen] = useState(false);

  const clear = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const onTouchStart = (e?: { target: EventTarget | null }) => {
    longPressed.current = false;
    clear();
    // Holding a finger in the description/tag editor is the phone's select/paste
    // gesture: opening the row menu there also blocked the native one.
    if (e?.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"], [role="menu"]')) return;
    pressTimer.current = setTimeout(() => { longPressed.current = true; setOpen(true); onLongPress(); }, delay);
  };
  const consumeTap = () => {
    if (!longPressed.current) return false;
    longPressed.current = false;
    return true;
  };
  // Android dispara `contextmenu` (e seleciona o título) no mesmo toque longo que
  // abre o nosso menu. Só bloqueia com um toque em curso — o botão direito no
  // desktop não passa por touchstart e segue livre.
  const onContextMenu = (e: { preventDefault: () => void }) => {
    if (pressTimer.current || longPressed.current) e.preventDefault();
  };

  return {
    open,
    setOpen,
    consumeTap,
    handlers: { onTouchStart, onTouchMove: clear, onTouchEnd: clear, onTouchCancel: clear, onContextMenu },
  };
}
