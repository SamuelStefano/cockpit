import type { ReactNode } from 'react';
import { SessionGroupHeader } from './SessionGroupHeader';

export function SessionGroup({ label, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <section aria-label={label} className="space-y-0.5">
      <SessionGroupHeader label={label} />
      {children}
    </section>
  );
}
