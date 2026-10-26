import type { ReactNode } from 'react';

export function PairStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[11px] font-semibold text-orange-400 ring-1 ring-orange-500/30">{n}</span>
      <div className="min-w-0 flex-1">
        <h2 className="mb-2.5 text-[13px] font-medium leading-5 text-neutral-200">{title}</h2>
        {children}
      </div>
    </section>
  );
}
