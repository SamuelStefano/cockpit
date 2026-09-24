import type { ReactNode } from 'react';

// Below sm the label sits above its samples: a fixed 112px label beside them
// left a 214px sample column on a phone, and the samples column (no min-w-0)
// let the MCP App demo run 58px past the viewport.
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="shrink-0 text-[12px] text-neutral-600 sm:w-28">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
