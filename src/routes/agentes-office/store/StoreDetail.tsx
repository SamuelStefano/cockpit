import { Button, Modal } from '../../../components/primitives';
import { Mascot } from '../../../components/team/Mascot';
import type { CatalogEntry } from '../../../../shared/agent-catalog';
import { departmentById } from '../../../../shared/departments';
import { hireLabel } from './StoreCard';

interface StoreDetailProps { entry: CatalogEntry | null; hired: boolean; block: string | null; onHire: () => void; onClose: () => void }

export function StoreDetail({ entry, hired, block, onHire, onClose }: StoreDetailProps) {
  const color = entry ? departmentById(entry.department)?.color ?? '#525252' : '#525252';
  return (
    <Modal
      open={entry !== null} onClose={onClose} label={entry ? `Instruções de ${entry.name}` : undefined} maxWidth="max-w-xl"
      footer={entry && (
        <div className="flex items-center justify-end gap-3">
          {block && <span className="mr-auto text-[12px] text-neutral-500">{block}</span>}
          <Button variant="primary" size="sm" icon="plus" disabled={block !== null} onClick={onHire}>{hireLabel(hired)}</Button>
        </div>
      )}
    >
      {entry && (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <Mascot mascot={{ shape: entry.shape, color }} size={44} />
            <div className="min-w-0">
              <h2 className="truncate text-[17px] font-semibold text-neutral-50">{entry.name}</h2>
              <p className="text-[12.5px] text-neutral-400">{entry.tagline}</p>
            </div>
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">Instruções</h3>
          <div className="scroll-thin max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-[13px] leading-relaxed text-neutral-300">{entry.instructions}</div>
        </div>
      )}
    </Modal>
  );
}
