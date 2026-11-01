import type { ReactNode } from 'react';

// Desktop body footer: quiet warnings on the right; the machine lives on the rail. In the chat it renders
// inside the chat column (left of the team rail); other routes get it under the page.
export function BodyFooter({ end }: { end?: ReactNode }) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-end gap-3 px-2.5 pb-1">
      <div className="flex min-w-0 items-center gap-2">{end}</div>
    </div>
  );
}
