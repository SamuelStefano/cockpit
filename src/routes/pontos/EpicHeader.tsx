import type { ReactNode } from 'react';

interface Props {
  eyebrow: ReactNode;
  title: ReactNode;
  figure: string;         // the epic's R$, the number the eye looks for first
  facts: ReactNode;       // pt · tasks · deliveries
  meter: ReactNode;
  actions?: ReactNode;
  notice?: ReactNode;
}

// Top of an epic's detail, same for a Deck draft and a DFL epic: where it lives,
// its name, its value against the per-epic cap, and what can be done with it.
export function EpicHeader({ eyebrow, title, figure, facts, meter, actions, notice }: Props) {
  return (
    <header className="pb-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-80">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] lowercase tracking-wide text-neutral-500">{eyebrow}</div>
          <h2 className="mt-1 text-[17px] font-semibold leading-snug tracking-tight text-neutral-50">{title}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          <span className="font-mono text-[22px] font-semibold leading-none tabular-nums tracking-tight text-neutral-50">{figure}</span>
          <span className="font-mono text-[11px] tabular-nums text-neutral-500">{facts}</span>
          {meter}
        </div>
      </div>
      {actions && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{actions}</div>}
      {notice}
    </header>
  );
}
