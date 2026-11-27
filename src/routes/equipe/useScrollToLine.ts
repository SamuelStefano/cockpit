import { useEffect, useRef } from 'react';

export function useScrollToLine<T extends HTMLElement>(line: number | undefined) {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'center' }); }, [line]);
  return ref;
}
