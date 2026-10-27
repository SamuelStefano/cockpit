import { useCallback, useState } from 'react';

export function useHeaderMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return { open, close, toggle: () => setOpen((o) => !o) };
}
