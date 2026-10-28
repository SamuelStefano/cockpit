import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const TopBarSlotContext = createContext<HTMLElement | null>(null);

// Renders its children inside the phone top bar's action slot. Outside the phone
// layout there is no slot, so the children are simply not rendered.
export function TopBarAction({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlotContext);
  return slot ? createPortal(children, slot) : null;
}
