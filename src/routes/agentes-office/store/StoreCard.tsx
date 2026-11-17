import { Button, tokens } from '../../../components/primitives';
import { Mascot } from '../../../components/team/Mascot';
import { catalogEntry, type CatalogEntry } from '../../../../shared/agent-catalog';
import { departmentById } from '../../../../shared/departments';
import { skillsLabel } from './hire-state';

interface StoreCardProps {
  entry: CatalogEntry;
  hired: boolean;
  skillCount: number;
  block: string | null;
  onHire: () => void;
  onOpen: () => void;
}

export function hireLabel(hired: boolean) { return hired ? 'Contratar outro' : 'Contratar'; }

export function StoreCard({ entry, hired, skillCount, block, onHire, onOpen }: StoreCardProps) {
  const color = departmentById(entry.department)?.color ?? '#525252';
  const lead = entry.reportsTo ? catalogEntry(entry.reportsTo) : undefined;
  return (
    <article onClick={onOpen} className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 transition hover:border-neutral-700 hover:bg-neutral-800/60">
      <button type="button" aria-label={`Ver instruções de ${entry.name}`} className={`flex min-w-0 items-start gap-3 rounded-lg text-left ${tokens.focusRing}`}>
        <Mascot mascot={{ shape: entry.shape, color }} size={48} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-neutral-50">{entry.name}</span>
            {hired && <span className="shrink-0 rounded-md border border-neutral-700 px-1.5 text-[10.5px] text-neutral-400">Já na equipe</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-neutral-400">{entry.tagline}</span>
        </span>
      </button>
      <div className="flex min-h-4 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-neutral-500">
        {lead && <span>responde a {lead.name}</span>}
        {skillCount > 0 && <span>{skillsLabel(skillCount)}</span>}
      </div>
      <div className="mt-auto flex flex-col gap-1.5">
        <Button variant={hired ? 'secondary' : 'primary'} size="sm" icon="plus" disabled={block !== null} className="w-full" onClick={(e) => { e.stopPropagation(); onHire(); }}>
          {hireLabel(hired)}
        </Button>
        {block && <span className="text-[11.5px] text-neutral-500">{block}</span>}
      </div>
    </article>
  );
}
