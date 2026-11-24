import { useEffect, useRef, useState } from 'react';

// While the rail animates its width, the content already has its final layout:
// clip it so the expanded rows are revealed instead of squeezed into the
// narrow box. Clipping only during the transition keeps popovers anchored
// inside the aside visible the rest of the time.
export function useWidthTransition(expanded: boolean) {
  const [animating, setAnimating] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 260);
    return () => clearTimeout(t);
  }, [expanded]);
  return animating;
}
