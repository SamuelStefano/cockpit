import { useCallback, useState } from 'react';

// Open/closed state of a collapsible block or an inline menu.
export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return { on, toggle, set: setOn };
}
