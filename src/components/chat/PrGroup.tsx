import { Icon } from '../primitives';
import { safeHref } from '../../lib/safe-href';
import { prGroupView } from './pr-group';
import type { PrLink } from '../../data/mock';

// Run de PRs num divisor único: os links quebram linha em vez de virar uma linha
// cheia por PR, que enterrava o prompt e a resposta em volta. Uma PR sozinha não
// vira grupo — mantém o rótulo inteiro, sem cabeçalho de contagem.
export function PrGroup({ prs }: { prs: PrLink[] }) {
  const view = prGroupView(prs);
  const single = prs.length === 1;
  const items = single ? prs : view.items;
  return (
    <>
      <Icon name="arrowUp" size={11} className="shrink-0 text-orange-400/80" />
      {single ? null : (
        <span className="shrink-0">{items.length} PRs{view.repo ? ` · ${view.repo}` : ''}</span>
      )}
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-neutral-500">
        {items.map((p, i) => {
          const href = safeHref(p.url);
          return href === undefined ? (
            <span key={`${p.url}-${i}`} className="tabular-nums">{p.label}</span>
          ) : (
            <a
              key={`${p.url}-${i}`} href={href} target="_blank" rel="noreferrer"
              className="tabular-nums underline decoration-neutral-700 underline-offset-2 transition hover:text-orange-300"
            >
              {p.label}
            </a>
          );
        })}
      </span>
    </>
  );
}
