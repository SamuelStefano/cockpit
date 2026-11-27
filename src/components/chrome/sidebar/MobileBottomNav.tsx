import { useState } from 'react';
import type { ConnState } from '../../primitives';
import type { Route } from '../../../useRoute';
import type { NavRole } from '../nav-routes';
import { MobileMoreSheet } from './MobileMoreSheet';
import { MobileTabBar } from './MobileTabBar';
import type { AccountProps } from './SidebarFooter';

interface MobileBottomNavProps {
  role: NavRole;
  route: Route;
  pending: number;
  conn: ConnState;
  account: AccountProps;
  onNavigate: (to: Route) => void;
  onConversations: () => void;
  onSearch: () => void;
}

export function MobileBottomNav({ role, route, pending, conn, account, onNavigate, onConversations, onSearch }: MobileBottomNavProps) {
  const [more, setMore] = useState(false);
  return (
    <>
      <MobileTabBar role={role} route={route} onNavigate={onNavigate} onConversations={onConversations} onMore={() => setMore(true)} />
      {more && (
        <MobileMoreSheet role={role} route={route} pending={pending} conn={conn} account={account} onNavigate={onNavigate} onSearch={onSearch} onClose={() => setMore(false)} />
      )}
    </>
  );
}
