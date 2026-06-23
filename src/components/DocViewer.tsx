import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Markdown, splitFences, tokens, WikilinkContext, type IconName, type WikilinkResolver } from './primitives';
import { headingSlug } from './primitives/markdown/slug';
import { useCopied } from '../lib/useCopied';

interface OutlineItem { level: number; text: string; slug: string }

// Extrai o índice de headings do mesmo jeito que o proseBlocks os renderiza: só
// blocos de UMA linha que casam `^#{1,6} ` contam (e fora de cercas de código),
// senão o link do índice apontaria pra uma âncora que não existe no DOM.
function outlineOf(body: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  for (const seg of splitFences(body)) {
    if (seg.t !== 'prose') continue;
    for (const block of seg.text.split('\n\n')) {
      const bl = block.trim();
      if (bl.split('\n').length !== 1) continue;
      const m = /^(#{1,6})\s+(.*)$/.exec(bl);
      if (m) items.push({ level: m[1].length, text: m[2], slug: headingSlug(m[2]) });
    }
  }
  return items;
}

function plainHeading(text: string): string {
  return text.replace(/[`*~_]/g, '').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// Visualizador de documento (contexto/skill). Desktop: diálogo largo com índice
// (rail de headings) à esquerda e leitura confortável à direita. Mobile:
// bottom-sheet de largura cheia, sem rail. Toggle de markdown cru. Esc fecha.
export function DocViewer({
  title, badges, actions, body,
  onClose, onWikilink,
}: {
  title: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  body: string;
  onClose: () => void;
  onWikilink?: WikilinkResolver;
}) {
  const [raw, setRaw] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outline = useMemo(() => outlineOf(body), [body]);
  const hasOutline = outline.length >= 3;

  useEffect(() => {
    // defaultPrevented + preventDefault: um Esc fecha um overlay só — quem consome
    // marca o evento e os listeners dos overlays de baixo ignoram o mesmo keypress.
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing) { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Scroll-spy: destaca no índice a seção mais alta visível na área de leitura.
  useEffect(() => {
    if (raw || !hasOutline) return;
    const root = scrollRef.current;
    if (!root) return;
    const heads = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')).filter((h) => h.id);
    if (!heads.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [raw, hasOutline, body]);

  const jump = (slug: string) => {
    scrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(slug);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Visualizador de documento"
        onClick={(e) => e.stopPropagation()}
        className="fade-up relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-neutral-800 bg-neutral-950 shadow-2xl sm:max-h-[88dvh] sm:max-w-5xl sm:rounded-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-neutral-700 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">{title}{badges}</div>
          <div className="flex shrink-0 items-center gap-1.5">
            <DocAction label={raw ? 'lido' : 'cru'} icon={raw ? 'check' : 'file'} onClick={() => setRaw((v) => !v)} />
            {actions}
            <Button variant="ghost" square icon="x" onClick={onClose} title="Fechar (Esc)" />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {hasOutline && !raw && (
            <nav className="scroll-thin hidden w-56 shrink-0 overscroll-contain overflow-y-auto border-r border-neutral-800/80 px-2 py-4 lg:block">
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Nesta página</p>
              {outline.map((o, oi) => (
                <button
                  key={`${o.slug}-${oi}`}
                  onClick={() => jump(o.slug)}
                  style={{ paddingLeft: 8 + (o.level - 1) * 10 }}
                  className={`block w-full truncate rounded-md py-1 pr-2 text-left text-[12px] leading-snug transition ${tokens.focusRing}
                    ${active === o.slug ? 'bg-orange-500/10 font-medium text-orange-300' : 'text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300'}`}
                  title={plainHeading(o.text)}
                >
                  {plainHeading(o.text)}
                </button>
              ))}
            </nav>
          )}

          <div ref={scrollRef} className="scroll-thin flex-1 overscroll-contain overflow-y-auto px-4 py-5 sm:px-7">
            {raw ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-neutral-400">{body}</pre>
            ) : (
              <div className="mx-auto max-w-[74ch]">
                <WikilinkContext.Provider value={onWikilink ?? null}>
                  <Markdown md={body} />
                </WikilinkContext.Provider>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Botão de header reaproveitável (copiar/baixar).
export function DocAction({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" icon={icon} onClick={onClick} title={label}>
      {label}
    </Button>
  );
}

// Botão "copiar" com feedback de estado, usado pelos dois viewers.
export function CopyDocAction({ text }: { text: string }) {
  const [copied, copy, failed] = useCopied();
  return <DocAction label={copied ? 'copiado!' : failed ? 'falhou' : 'copiar'} icon={copied ? 'check' : failed ? 'x' : 'copy'} onClick={() => copy(text)} />;
}
