import { Button, EmptyState } from '../../components/primitives';
import type { RegistryRef, RegistrySkill } from '../../../shared/protocol';
import { skillAuthor } from '../../lib/skill-packs';

interface Props {
  skills: RegistrySkill[];
  installing: ReadonlySet<string>;
  onInstall: (key: string, items: RegistryRef[]) => void;
}

export function DiscoverView({ skills, installing, onInstall }: Props) {
  if (skills.length === 0) {
    return <EmptyState icon="check" title="Nada novo por aqui" description="Você já tem tudo do catálogo que bate com a busca." />;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      {skills.map((s) => {
        const key = `skill:${s.source}/${s.slug}`;
        return (
          <div key={key} className="flex min-h-14 items-center gap-4 border-t border-neutral-800 px-4 py-2.5 first:border-t-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-neutral-100">{s.name || s.slug}</span>
              <small className="block truncate text-[12px] text-neutral-500">{s.description || '—'}</small>
            </span>
            <span className="hidden w-32 shrink-0 truncate text-[12px] text-neutral-500 sm:block">{skillAuthor(s)}</span>
            <Button size="sm" variant="secondary" icon="download" loading={installing.has(key)} aria-label={`Instalar ${s.slug}`}
              onClick={() => onInstall(key, [{ source: s.source, slug: s.slug }])}>Instalar</Button>
          </div>
        );
      })}
    </div>
  );
}
