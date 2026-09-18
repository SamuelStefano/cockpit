import { EmptyState } from '../../components/primitives';
import type { RegistryRef, RegistrySkill } from '../../../shared/protocol';
import { RegistryCard } from './RegistryCard';

interface Props {
  skills: RegistrySkill[];
  installing: ReadonlySet<string>;
  onInstall: (key: string, items: RegistryRef[]) => void;
}

export function DiscoverView({ skills, installing, onInstall }: Props) {
  if (skills.length === 0) {
    return <EmptyState icon="check" title="Nada novo por aqui" description="Você já tem tudo do registro que bate com a busca." />;
  }
  return (
    <div className="stagger-fade grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((s) => (
        <RegistryCard key={`${s.source}/${s.slug}`} s={s} installing={installing.has(`skill:${s.source}/${s.slug}`)} onInstall={onInstall} />
      ))}
    </div>
  );
}
