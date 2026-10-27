import { MobileDrawer } from '../../MobileDrawer';
import { useEscapeLayer } from '../../primitives/useEscapeLayer';
import { DrawerNav, type DrawerNavProps } from './DrawerNav';

// Off the chat route there is no sessions list, so the drawer is just the nav.
export function MobileNavDrawer({ open, onClose, ...nav }: DrawerNavProps & { open: boolean; onClose: () => void }) {
  useEscapeLayer(open, onClose);
  if (!open) return null;
  return (
    <MobileDrawer onClose={onClose}>
      <DrawerNav {...nav} />
    </MobileDrawer>
  );
}
