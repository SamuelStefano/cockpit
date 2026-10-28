import type { ReactNode } from 'react';
import { BoxSwitcher } from '../sessions/BoxSwitcher';

// Desktop body footer: machine on the left, quiet warnings on the right. One slim line, so the
// sidebar no longer spends a row on the switcher nor the panel a row on the quota notice.
export function BodyFooter({ userId, end }: { userId?: string; end?: ReactNode }) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-3 bg-neutral-900 px-2.5">
      <BoxSwitcher userId={userId} variant="chip" />
      <div className="flex min-w-0 items-center gap-2">{end}</div>
    </div>
  );
}
