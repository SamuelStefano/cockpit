import { Badge, Button, Icon, ProgressBar } from '../../components/primitives';
import type { RegistryRef } from '../../../shared/protocol';
import type { PackView } from '../../lib/skill-packs';
import { PackMemberChip } from './PackMemberChip';

interface Props {
  view: PackView;
  installing: boolean;
  compact?: boolean;
  onInstall: (key: string, items: RegistryRef[]) => void;
  onOpen: (id: string) => void;
}

export function PackPanel({ view, installing, compact, onInstall, onOpen }: Props) {
  const { pack, members, installedCount, missing, missingSuggested, complete } = view;
  const key = `pack:${pack.source}/${pack.slug}`;
  return (
    <section className="rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-500/15 text-orange-400"><Icon name="layers" size={12} /></span>
            <Badge tone="orange">pack</Badge>
            <Badge tone={complete ? 'green' : 'neutral'}>{installedCount}/{members.length} instaladas</Badge>
          </div>
          <h3 className="text-[14px] font-semibold text-neutral-100">{pack.name}</h3>
          {!compact && pack.description && <p className="mt-0.5 max-w-2xl text-[12px] leading-snug text-neutral-500">{pack.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {missingSuggested.length > 0 && complete && (
            <Button variant="ghost" size="sm" loading={installing} onClick={() => onInstall(key, missingSuggested)}>+ {missingSuggested.length} sugerida{missingSuggested.length > 1 ? 's' : ''}</Button>
          )}
          {complete
            ? <Badge tone="green" dot>completo</Badge>
            : <Button size="sm" icon="download" loading={installing} onClick={() => onInstall(key, missing)}>Instalar {missing.length} faltando</Button>}
        </div>
      </header>
      <ProgressBar segments={[{ value: installedCount, tone: complete ? 'green' : 'orange' }, { value: members.length - installedCount, tone: 'track' }]} className="mb-3" />
      <div className="flex flex-wrap gap-1.5">
        {members.map((m) => <PackMemberChip key={m.slug} m={m} onOpen={onOpen} />)}
      </div>
    </section>
  );
}
