import type { RegistryRef } from '../../../shared/protocol';
import type { PackView, SkillGroup } from '../../lib/skill-packs';
import { PackPanel } from './PackPanel';
import { SkillGroupSection } from './SkillGroupSection';

interface Props {
  packs: PackView[];
  groups: SkillGroup[];
  installing: ReadonlySet<string>;
  onInstall: (key: string, items: RegistryRef[]) => void;
  onOpen: (id: string) => void;
}

export function InstalledView({ packs, groups, installing, onInstall, onOpen }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {packs.length > 0 && (
        <div className="flex flex-col gap-3">
          {packs.map((v) => (
            <PackPanel key={`${v.pack.source}/${v.pack.slug}`} view={v} compact installing={installing.has(`pack:${v.pack.source}/${v.pack.slug}`)} onInstall={onInstall} onOpen={onOpen} />
          ))}
        </div>
      )}
      {groups.map((g) => <SkillGroupSection key={g.label} group={g} onOpen={onOpen} />)}
    </div>
  );
}
