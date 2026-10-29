import { Icon } from '../primitives';
import type { BotView } from '../../routes/equipe/team-view';
import { TeamRoster } from './TeamRoster';
import type { TeamEntry } from './team-order';

export interface TeamSheetProps {
  views: BotView[];
  entries: TeamEntry[];
  working: number;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onGo: (to: '/equipe/rotinas' | '/equipe/memoria') => void;
  canManage: boolean;
  onClose: () => void;
}

// Agent picker: 56 px rows with the living phrase, then the admin actions (routines, memory, new agent).
export function TeamSheet({ entries, working, activeId, onOpen, onNew, onGo, canManage, onClose }: TeamSheetProps) {
  const go = (fn: () => void) => () => { onClose(); fn(); };
  const item = 'flex h-11 w-full items-center gap-3 rounded-lg px-2.5 text-[14px] text-neutral-300 hover:bg-neutral-800/50 pointer-coarse:h-12';
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between px-2.5 pb-1.5">
        <h2 className="text-[15px] font-semibold text-neutral-100">Equipe</h2>
        {working > 0 && <span className="text-[12px] text-neutral-500">{working} trabalhando</span>}
      </div>
      <div className="scroll-thin flex max-h-[55dvh] flex-col overflow-y-auto">
        <TeamRoster entries={entries} activeId={activeId} onOpen={(id) => go(() => onOpen(id))()} rowHeight={56} />
      </div>
      <div className="mt-1.5 flex flex-col border-t border-neutral-800/80 pt-1.5">
        {canManage && (
          <>
            <button type="button" onClick={go(() => onGo('/equipe/rotinas'))} className={item}><Icon name="clock" size={18} />Rotinas</button>
            <button type="button" onClick={go(() => onGo('/equipe/memoria'))} className={item}><Icon name="brain" size={18} />Memória</button>
            <button type="button" onClick={go(onNew)} className={item}><Icon name="plus" size={18} />Novo agente</button>
          </>
        )}
      </div>
    </div>
  );
}
