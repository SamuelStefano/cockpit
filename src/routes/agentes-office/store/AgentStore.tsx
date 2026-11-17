import { useState } from 'react';
import type { SkillMeta, TeamBot, TeamBotInput } from '../../../../shared/protocol';
import { catalogByDepartment, type CatalogEntry } from '../../../../shared/agent-catalog';
import { Button } from '../../../components/primitives';
import { alreadyHired } from './hire-state';
import { StoreCard } from './StoreCard';
import { StoreDetail } from './StoreDetail';
import { useAgentStore } from './useAgentStore';

interface AgentStoreProps {
  bots: TeamBot[];
  skills: SkillMeta[];
  canEdit: boolean;
  onSave: (bot: TeamBotInput) => void;
  onHired: (firstId: string, count: number) => void;
}

export function AgentStore(props: AgentStoreProps) {
  const { bots } = props;
  const store = useAgentStore(props);
  const [open, setOpen] = useState<CatalogEntry | null>(null);
  const groups = catalogByDepartment();
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-170 text-[14px] text-neutral-400">Agentes prontos para contratar, um a um ou o setor inteiro. Cada um chega com instruções e habilidades; você ajusta o que quiser depois.</p>
      {groups.map(({ department, entries }) => {
        const setorBlock = store.block(entries.length);
        return (
          <section key={department.id} aria-label={department.name} className="flex flex-col gap-3">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-2">
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: department.color }} />
              <h2 className="mr-auto text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: department.color }}>{department.name}</h2>
              {setorBlock && <span className="hidden text-[11.5px] text-neutral-500 sm:inline">{setorBlock}</span>}
              <Button variant="secondary" size="xs" icon="users" disabled={setorBlock !== null} aria-label={`Contratar setor ${department.name}`} onClick={() => store.hire(entries)}>Contratar setor</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entries.map((e) => (
                <StoreCard key={e.id} entry={e} hired={alreadyHired(bots, e.name)} skillCount={e.skills.filter((s) => store.installed.has(s)).length}
                  block={store.block(1)} onHire={() => store.hire([e])} onOpen={() => setOpen(e)} />
              ))}
            </div>
          </section>
        );
      })}
      <StoreDetail entry={open} hired={open ? alreadyHired(bots, open.name) : false} block={store.block(1)}
        onHire={() => { if (open) { store.hire([open]); setOpen(null); } }} onClose={() => setOpen(null)} />
    </div>
  );
}
