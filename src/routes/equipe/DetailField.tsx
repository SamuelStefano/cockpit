import type { ReactNode } from 'react';

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11.5px] font-medium uppercase tracking-wide text-neutral-600">{label}</span>
      <div className="text-[13px] text-neutral-300">{children}</div>
    </div>
  );
}
