import type { PrReviewThread } from '../../../shared/prs';
import { Badge } from '../../components/primitives/Badge';
import { Markdown } from '../../components/primitives/Markdown';
import { relativeTime } from './prs-view';

// `inline` sits between two code rows, so it leaves the monospace/pre context.
export function PrThreadNote({ thread, inline = false }: { thread: PrReviewThread; inline?: boolean }) {
  return (
    <div className={`whitespace-normal font-sans ${inline ? 'sticky left-0 max-w-[min(46rem,100vw)] border-y border-neutral-800 bg-neutral-950 px-3 py-2' : ''}`}>
      <div className={`rounded-lg border bg-neutral-900/70 ${thread.resolved ? 'border-neutral-800 opacity-70' : 'border-orange-500/30'}`}>
        {(thread.resolved || thread.outdated || (!inline && thread.line)) && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-800/80 px-3 py-1.5">
            {!inline && thread.line && <span className="font-mono text-[12px] text-neutral-500">linha {thread.line}</span>}
            {thread.resolved && <Badge tone="green">Resolvido</Badge>}
            {thread.outdated && <Badge>Desatualizado</Badge>}
          </div>
        )}
        <ul className="divide-y divide-neutral-800/80">
          {thread.comments.map((c, i) => (
            <li key={i} className="px-3 py-2">
              <p className="mb-1 text-[12px] text-neutral-500"><span className="font-medium text-neutral-300">{c.author}</span> · {relativeTime(c.createdAt)}</p>
              <Markdown md={c.body} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
