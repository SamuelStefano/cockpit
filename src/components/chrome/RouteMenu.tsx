import { useEffect, useRef, useState } from 'react';
import { Icon } from '../primitives';
import { navFor } from './nav-routes';
import type { Route } from '../../useRoute';

// Em telas estreitas as 6 abas não cabem no header (eram cortadas). Aqui viram um
// dropdown compacto que mostra a rota atual e abre a lista ao toque.
export function RouteMenu({ route, nav, isAdmin }: { route: Route; nav: (to: Route) => void; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const items = navFor(isAdmin);
  const current = items.find((n) => n.to === route) ?? items[0];
  return (
    <div ref={wrapRef} className="relative md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 font-mono text-[11.5px] lowercase tracking-tight text-orange-300"
      >
        {current.label}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-2xl">
          {items.map((n) => (
            <button
              key={n.to}
              onClick={() => { nav(n.to); setOpen(false); }}
              className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left font-mono text-[12px] lowercase tracking-tight transition
                ${route === n.to ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
