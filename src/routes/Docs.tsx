import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, tokens } from '../components/primitives';
import { SECTIONS } from './docs-data';
import { DocSections } from './docs/sections';
import { revealIn } from './docs/reveal';

// Documentação do app, 100% client-side (conteúdo estático). Uma rota só, com
// navegação por seções (scrollspy) à esquerda e cartões explicativos. Sem dados
// do backend: é manual de uso, sempre disponível mesmo offline. O conteúdo vive
// em ./docs/sections.tsx (texto) e ./docs-data.ts (dados); aqui fica só a casca
// de layout — nav lateral, chips mobile e o scrollspy.

export function Docs() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  // The scrollspy moved the highlight off-screen: past the 20th section the active
  // entry sat below the sidebar's fold, and on a phone the active chip was ~2800px
  // to the right of a strip that shows three. Follow it in both lists.
  useEffect(() => {
    const sel = `[data-sec="${active}"]`;
    revealIn(navRef.current, sel, 'y');
    revealIn(chipsRef.current, sel, 'x');
  }, [active]);

  // Scrollspy: a seção mais alta visível vira a ativa no menu lateral.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { root, rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="flex min-h-0 flex-1 bg-neutral-950">
      {/* Nav lateral (scrollspy) — só desktop */}
      {/* Scrolls on its own: with 20+ sections the list ran past the status bar and
          the last entries could not be reached. */}
      <aside ref={navRef} className="scroll-thin hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-800/80 lg:block">
        <div className="p-4">
          <div className="mb-4 px-2">
            <div className="font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">documentação</div>
            <div className="mt-0.5 text-[11px] text-neutral-500">manual do Deck</div>
          </div>
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                data-sec={s.id}
                onClick={() => jump(s.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[12.5px] transition ${tokens.focusRing}
                  ${active === s.id ? 'border-orange-500/40 bg-orange-500/15 font-medium text-orange-300' : 'border-transparent text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300'}`}
              >
                <Icon name={s.icon} size={14} className="shrink-0" />
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Conteúdo */}
      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto scroll-smooth">
        {/* Chips de navegação — só mobile */}
        <div className="sticky top-0 z-10 border-b border-neutral-800/80 bg-neutral-950/90 px-4 py-2.5 backdrop-blur-sm lg:hidden">
          <div ref={chipsRef} className="scroll-thin flex gap-1.5 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                data-sec={s.id}
                onClick={() => jump(s.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition
                  ${active === s.id ? 'border-orange-500/40 bg-orange-500/15 text-orange-300' : 'border-neutral-800 text-neutral-500'}`}
              >
                <Icon name={s.icon} size={12} /> {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
          <DocSections year={year} />
        </div>
      </div>
    </div>
  );
}
