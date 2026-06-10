import { Icon, Badge } from '../../components/primitives';
import type { SkillMeta } from '../../../shared/protocol';

export function SkillCard({ s, onClick }: { s: SkillMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5 text-left transition hover:-translate-y-px hover:border-orange-500/40 hover:bg-orange-500/[0.05] hover:shadow-lg hover:shadow-black/30"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
            <Icon name="sparkles" size={12} />
          </span>
          <Badge tone="neutral">skill</Badge>
        </span>
      </div>
      <h3 className="mb-1 line-clamp-1 font-mono text-[13px] font-medium lowercase text-neutral-200 group-hover:text-orange-300">{s.name}</h3>
      <p className="line-clamp-3 text-[12px] leading-snug text-neutral-500">{s.description || '—'}</p>
    </button>
  );
}
