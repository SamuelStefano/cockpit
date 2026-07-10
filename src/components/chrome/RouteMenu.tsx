import { useEffect, useRef } from 'react';
import { Icon } from '../primitives';
import { navFor } from './nav-routes';
import type { Route } from '../../useRoute';

// Em telas estreitas as 6 abas não cabem no header (eram cortadas). Aqui viram um
// dropdown compacto que mostra a rota atual e abre a lista ao toque.
// Controlado pelo App (open/setOpen) pra ser mutuamente exclusivo com o drawer de
// sessões no mobile — abrir um fecha o outro (senão os dois overlays se sobrepõem).
export function RouteMenu({ route, nav, isAdmin, open, setOpen }: { route: Route; nav: (to: Route) => void; isAdmin: boolean; open: boolean; setOpen: (v: boolean) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // pointerdown cobre toque (mobile) e mouse — mousedown sozinho não fechava em
    // alguns webviews de celular, deixando o menu aberto sob outro overlay.
    const onDoc = (e: Event) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, setOpen]);
  const items = navFor(isAdmin);
  const current = items.find((n) => n.to === route) ?? items[0];
  return (
    <div ref={wrapRef} className="relative md:hidden">
      <button
        onClick={() => setOpen(!open)}
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
