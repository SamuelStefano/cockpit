import { EmptyState } from '../../components/primitives';
import type { RegistryRef } from '../../../shared/protocol';
import type { PackView } from '../../lib/skill-packs';
import { PackPanel } from './PackPanel';
import { PackRoleLegend } from './PackRoleLegend';

interface Props {
  packs: PackView[];
  installing: ReadonlySet<string>;
  onInstall: (key: string, items: RegistryRef[]) => void;
  onOpen: (id: string) => void;
}

export function PacksView({ packs, installing, onInstall, onOpen }: Props) {
  if (packs.length === 0) {
    return <EmptyState icon="search" title="Nenhum pack" description="O registro não tem pack que bata com a busca." />;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-neutral-500">
        Um pack é uma skill raiz mais as skills que ela chama. Instalar o pack traz as que faltam; as que você já tem ficam como estão.
      </p>
      <PackRoleLegend />
      {packs.map((v) => (
        <PackPanel key={v.pack.slug} view={v} installing={installing.has(`pack:${v.pack.source}/${v.pack.slug}`)} onInstall={onInstall} onOpen={onOpen} />
      ))}
    </div>
  );
}
