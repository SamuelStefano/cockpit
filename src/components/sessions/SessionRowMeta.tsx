import { Icon } from '../primitives';
import { SessionRowActions } from './SessionRowActions';

interface SessionRowMetaProps {
  relative: string;
  cost?: number;
  pinned: boolean;
  running: boolean;
  tagging: boolean;
  canTag: boolean;
  canStop: boolean;
  canDescribe: boolean;
  actionsOpen: boolean;
  setActionsOpen: (v: boolean) => void;
  setTagging: (v: boolean) => void;
  onTogglePin?: () => void;
  onRename: () => void;
  onDescribe: () => void;
  onStop?: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function SessionRowMeta({ relative, cost, pinned, running, tagging, canTag, canStop, canDescribe, actionsOpen, setActionsOpen, setTagging, onTogglePin, onRename, onDescribe, onStop, onArchive, onDelete }: SessionRowMetaProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {cost !== undefined && cost > 0 && (
        <span className="hidden text-[9.5px] tabular-nums text-emerald-500/70 sm:inline" title="Custo estimado acumulado desta sessão">
          ${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}
        </span>
      )}
      <span className="hidden text-[10px] tabular-nums text-neutral-600 sm:inline">{relative}</span>
      {pinned && (
        <span title="Sessão fixada" className="text-orange-400">
          <Icon name="star" size={11} />
        </span>
      )}
      {canTag && (
        <button
          onClick={(e) => { e.stopPropagation(); setTagging(!tagging); }}
          title="Adicionar etiqueta"
          className="block rounded p-0.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-sky-300 sm:hidden sm:group-hover:block"
        >
          <Icon name="tag" size={12} />
        </button>
      )}
      <SessionRowActions
        pinned={pinned}
        running={running}
        canStop={canStop}
        canDescribe={canDescribe}
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        onTogglePin={onTogglePin}
        onRename={onRename}
        onDescribe={onDescribe}
        onStop={onStop}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    </div>
  );
}
