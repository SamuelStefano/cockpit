import type { PrDetail } from '../../../shared/prs';
import { EmptyState } from '../../components/primitives/EmptyState';
import { Markdown } from '../../components/primitives/Markdown';
import { relativeTime } from './prs-view';

export function PrConversationTab({ detail }: { detail: PrDetail }) {
  if (!detail.comments.length) return <EmptyState size="xs" title="Sem comentários" />;
  return (
    <ul className="space-y-3">
      {detail.comments.map((c, i) => (
        <li key={`${c.createdAt}-${i}`} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-neutral-500">
            <span className="font-medium text-neutral-300">{c.author}</span>
            <span>{c.kind === 'review' ? 'review' : 'comentário'}</span>
            <span>{relativeTime(c.createdAt)}</span>
            {c.path && <span className="truncate font-mono">{c.path}</span>}
          </div>
          {c.body.trim() ? <Markdown md={c.body} /> : <p className="text-[13px] text-neutral-600">(sem texto)</p>}
        </li>
      ))}
    </ul>
  );
}
