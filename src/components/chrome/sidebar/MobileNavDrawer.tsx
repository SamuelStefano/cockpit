import type { ReactNode } from 'react';
import { MobileDrawer } from '../../MobileDrawer';
import { useEscapeLayer } from '../../primitives/useEscapeLayer';

// Off the chat route the drawer is mounted here; on the chat route MobileLayout owns it.
export function MobileNavDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEscapeLayer(open, onClose);
  if (!open) return null;
  return <MobileDrawer onClose={onClose}>{children}</MobileDrawer>;
}
