import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '../components/primitives';

export function Collapsible({ title, children, openOn }: { title: string; children: ReactNode; openOn?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!openOn) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(openOn, onOpen);
    return () => window.removeEventListener(openOn, onOpen);
  }, [openOn]);
  return (
    <section className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/40 max-lg:mt-0 max-lg:rounded-none max-lg:border-0 max-lg:border-t max-lg:bg-transparent">
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 max-lg:min-h-12 max-lg:px-0 text-left text-[13px] font-medium text-neutral-300 transition hover:text-neutral-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        <Icon name="chevronRight" size={13} className={open ? 'rotate-90 transition' : 'transition'} />
        {title}
      </button>
      {open && <div className="border-t border-neutral-800 p-4 max-lg:border-0 max-lg:px-0 max-lg:pt-0">{children}</div>}
    </section>
  );
}
