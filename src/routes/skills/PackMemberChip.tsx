import { Icon } from '../../components/primitives';
import type { PackMemberView } from '../../lib/skill-packs';

const ROLE_DOT: Record<PackMemberView['role'], string> = {
  root: 'bg-orange-400',
  required: 'bg-sky-400',
  optional: 'bg-neutral-400',
  suggested: 'bg-neutral-600',
};

export function PackMemberChip({ m, onOpen }: { m: PackMemberView; onOpen?: (id: string) => void }) {
  const title = `${m.slug} · ${m.role}${m.author ? ` · ${m.author}` : ''}${m.published ? '' : ' · não publicada'}${m.description ? `\n${m.description}` : ''}`;
  const base = 'flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11.5px] transition';
  const tone = m.installed
    ? 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-orange-500/40'
    : 'border-dashed border-neutral-800 text-neutral-500';
  const body = (
    <>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ROLE_DOT[m.role]}`} />
      <span className="truncate">{m.slug}</span>
      {m.installed && <Icon name="check" size={11} className="shrink-0 text-emerald-400" />}
    </>
  );
  if (m.installed && onOpen) {
    return <button title={title} onClick={() => onOpen(m.slug)} className={`${base} ${tone}`}>{body}</button>;
  }
  return <span title={title} className={`${base} ${tone} ${m.published ? '' : 'opacity-60'}`}>{body}</span>;
}
