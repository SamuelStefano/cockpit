import { EmptyState, Modal, SkeletonCards } from '../primitives';
import type { VersionsApi } from '../../cockpit/useVersions';
import { DiffView } from './DiffView';
import { VersionRow } from './VersionRow';

interface Props {
  api: VersionsApi;
  title: string;
  canRestore: boolean;
}

export function VersionsModal({ api, title, canRestore }: Props) {
  const latest = api.items[0]?.version;
  return (
    <Modal open={api.id !== null} onClose={api.close} title={`Versões — ${title}`} icon="clock" maxWidth="max-w-2xl">
      <div className="flex flex-col gap-3">
        {api.loading ? <SkeletonCards /> : api.items.length === 0 ? (
          <EmptyState icon="clock" title="Sem versões ainda" description="Cada salvamento daqui pra frente vira uma versão que dá pra comparar e restaurar." />
        ) : (
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto scroll-thin">
            {api.items.map((v) => (
              <VersionRow
                key={v.version} v={v} current={v.version === latest} selected={api.diff?.from === v.version}
                busy={api.restoring} onDiff={() => latest && api.showDiff(v.version, latest)}
                onRestore={canRestore ? () => api.restore(v.version) : undefined}
              />
            ))}
          </ul>
        )}
        {api.diff && (api.diff.error ? <p className="text-[13px] text-red-400">{api.diff.error}</p> : <DiffView text={api.diff.text} />)}
        {!canRestore && <p className="text-[12px] text-neutral-500">Só a conta root restaura versões de agente.</p>}
      </div>
    </Modal>
  );
}
