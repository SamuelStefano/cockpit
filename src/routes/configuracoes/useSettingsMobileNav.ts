import { useState } from 'react';

interface Args {
  isMobile: boolean;
  count: number;
  initiallyOpen: boolean;
}

// Phone: the index list is its own screen and a chosen section replaces it, with a back row.
export function useSettingsMobileNav({ isMobile, count, initiallyOpen }: Args) {
  const [open, setOpen] = useState(initiallyOpen);
  const sectioned = count > 1;
  const showList = isMobile && sectioned && !open;
  const showBack = isMobile && sectioned && open;
  return { showList, showBack, select: () => setOpen(true), back: () => setOpen(false) };
}
