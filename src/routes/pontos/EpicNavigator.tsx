import { Button, Input, Segmented } from '../../components/primitives';
import type { NavGroups } from './nav-model';
import type { TreeFilter } from './treeFilter';
import { NavGroup } from './NavGroup';
import { NavViewLink } from './NavViewLink';
import { NAV_COLS } from './nav-cols';

interface Props {
  nav: NavGroups;
  activeKey: string;
  onSelect: (key: string) => void;
  filter: TreeFilter;
  onFilter: (f: TreeFilter) => void;
  query: string;
  onQuery: (q: string) => void;
  marks: Map<string, number>;
  invoices: number;
  ledger: number;
  onNewEpic: () => void;
}

const FILTERS: { id: TreeFilter; label: string }[] = [
  { id: 'all', label: 'todos' }, { id: 'open', label: 'aberto' }, { id: 'todo', label: 'a fazer' }, { id: 'paid', label: 'pago' },
];

// Left pane: every epic in one list, grouped by where it stands — staged in the
// Deck, in DFL with work open, fully invoiced — plus the invoices and the ledger.
export function EpicNavigator({ nav, activeKey, onSelect, filter, onFilter, query, onQuery, marks, invoices, ledger, onNewEpic }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 px-2 pb-1 pt-2">
        <Input size="sm" icon="search" placeholder="buscar épico ou projeto" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Buscar épico" />
        <Segmented label="Filtrar por status" items={FILTERS} value={filter} onChange={onFilter} className="self-start" />
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        <div aria-hidden className="sticky top-0 z-10 flex h-6 items-center gap-2 bg-neutral-950 pl-2.5 pr-2 font-mono text-[9.5px] tracking-wide text-neutral-600">
          <span className="w-1.5 shrink-0" /><span className="flex-1">épico</span>
          <span className={NAV_COLS.pt}>pt</span><span className={NAV_COLS.brl}>R$</span><span className={NAV_COLS.cap}>teto</span>
        </div>
        <NavGroup title="rascunhos" rows={nav.drafts} activeKey={activeKey} onSelect={onSelect}
          empty={filter === 'all' || filter === 'todo' ? 'Nenhum rascunho. Peça um ao agente.' : undefined}
          action={<Button variant="ghost" size="xs" square icon="plus" onClick={onNewEpic} title="Novo épico com agente" aria-label="Novo épico com agente" />} />
        <NavGroup title="no dfl — em aberto" rows={nav.open} activeKey={activeKey} onSelect={onSelect} marks={marks} empty="Nada em aberto no DFL." />
        <NavGroup title="faturados" rows={nav.billed} activeKey={activeKey} onSelect={onSelect} marks={marks} defaultOpen={false} />
      </div>
      <div className="flex flex-col gap-px border-t border-neutral-800/80 p-1.5">
        <NavViewLink icon="file" label="Faturas" count={invoices} active={activeKey === 'view:faturas'} onClick={() => onSelect('view:faturas')} />
        <NavViewLink icon="sparkles" label="Ledger do agente" count={ledger} active={activeKey === 'view:ledger'} onClick={() => onSelect('view:ledger')} />
      </div>
    </div>
  );
}
