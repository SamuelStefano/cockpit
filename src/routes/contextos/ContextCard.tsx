import { Badge } from '../../components/primitives';
import { TYPE_TONE } from '../../components/ContextModal';
import type { ContextMeta } from '../../../shared/protocol';
import { relPast } from '../../lib/time';

export function ContextCard({ c, onClick }: { c: ContextMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5 text-left transition hover:-translate-y-px hover:border-orange-500/40 hover:bg-orange-500/[0.05] hover:shadow-lg hover:shadow-black/30"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Badge tone={TYPE_TONE[c.type] ?? 'neutral'}>{c.type}</Badge>
        <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">{relPast(c.mtime)}</span>
      </div>
      <h3 className="mb-1 line-clamp-1 text-[13px] font-medium text-neutral-200 group-hover:text-orange-300">{c.title}</h3>
      <p className="line-clamp-3 text-[12px] leading-snug text-neutral-500">{c.description || '—'}</p>
    </button>
  );
}
