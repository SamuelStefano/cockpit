import { useState, type ReactNode } from 'react';
import { Icon } from '../components/primitives';

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium text-neutral-300 transition hover:text-neutral-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        <Icon name="chevronRight" size={13} className={open ? 'rotate-90 transition' : 'transition'} />
        {title}
      </button>
      {open && <div className="border-t border-neutral-800 p-4">{children}</div>}
    </section>
  );
}
