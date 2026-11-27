import type { ReactNode } from 'react';
import { Button, IconButton } from '../../primitives';

interface AllSpaceSideProps {
  sessions: ReactNode;
  onNew: () => void;
  onCollapse: () => void;
  onManageAgents: () => void;
}

export function AllSpaceSide({ sessions, onNew, onCollapse, onManageAgents }: AllSpaceSideProps) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-3.5 pb-2.5 pt-3.5">
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-(--text)">Todas as conversas</h2>
        <Button size="xs" icon="plus" onClick={onNew} aria-label="Nova conversa">Nova</Button>
        <IconButton icon="panelLeft" label="Recolher barra lateral" size="sm" side="bottom" aria-expanded onClick={onCollapse} />
      </div>
      <div className="min-h-0 flex-1">{sessions}</div>
      <div className="flex min-h-13 shrink-0 items-center gap-2 border-t border-(--border) px-3 py-2.5">
        <Button variant="ghost" size="sm" icon="users" onClick={onManageAgents} className="flex-1">Gerenciar agentes</Button>
      </div>
    </>
  );
}
