import type { ReactNode } from 'react';
import { BoxSwitcher } from '../sessions/BoxSwitcher';

// Desktop body footer: machine on the left, quiet warnings on the right. In the chat it renders
// inside the chat column (left of the team rail); other routes get it under the page.
export function BodyFooter({ userId, end }: { userId?: string; end?: ReactNode }) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-3 px-2.5 pb-1">
      <BoxSwitcher userId={userId} variant="chip" />
      <div className="flex min-w-0 items-center gap-2">{end}</div>
    </div>
  );
}
