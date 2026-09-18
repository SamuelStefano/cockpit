import { Badge, Button, Icon } from '../../components/primitives';
import type { RegistryRef, RegistrySkill } from '../../../shared/protocol';
import { skillAuthor } from '../../lib/skill-packs';

interface Props {
  s: RegistrySkill;
  installing: boolean;
  onInstall: (key: string, items: RegistryRef[]) => void;
}

export function RegistryCard({ s, installing, onInstall }: Props) {
  const key = `skill:${s.source}/${s.slug}`;
  return (
    <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5 transition hairline hover:border-neutral-700">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-neutral-800 text-neutral-400"><Icon name="sparkles" size={12} /></span>
          {s.tags.includes('core') && <Badge tone="orange">core</Badge>}
        </span>
        <span className="truncate text-[11px] text-neutral-500">{skillAuthor(s)}</span>
      </div>
      <h3 className="mb-1 line-clamp-1 font-mono text-[13px] font-medium lowercase text-neutral-200">{s.slug}</h3>
      <p className="mb-3 line-clamp-3 flex-1 text-[12px] leading-snug text-neutral-500">{s.description || '—'}</p>
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" icon="download" loading={installing} onClick={() => onInstall(key, [{ source: s.source, slug: s.slug }])}>Instalar</Button>
      </div>
    </div>
  );
}
