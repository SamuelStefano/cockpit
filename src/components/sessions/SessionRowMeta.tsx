import { Icon } from '../primitives';
import { SessionRowActions } from './SessionRowActions';

interface SessionRowMetaProps {
  relative: string;
  pinned: boolean;
  running: boolean;
  tagging: boolean;
  canTag: boolean;
  canStop: boolean;
  canDescribe: boolean;
  marathon: boolean;
  onToggleMarathon?: () => void;
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

export function SessionRowMeta({ relative, pinned, running, tagging, canTag, canStop, canDescribe, marathon, onToggleMarathon, actionsOpen, setActionsOpen, setTagging, onTogglePin, onRename, onDescribe, onStop, onArchive, onDelete }: SessionRowMetaProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="hidden text-[10.5px] tabular-nums text-neutral-600 sm:inline" title="Última atividade">{relative}</span>
      {pinned && (
        <span title="Sessão fixada" className="text-orange-400">
          <Icon name="star" size={11} />
        </span>
      )}
      {marathon && (
        <span title="Modo maratona: sem teto de 8h, retoma sozinha" className="text-sky-400">
          <Icon name="zap" size={11} />
        </span>
      )}
      {canTag && (
        <button
          onClick={(e) => { e.stopPropagation(); setTagging(!tagging); }}
          title="Adicionar etiqueta"
          className="block rounded p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-sky-300 sm:p-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Icon name="tag" size={12} />
        </button>
      )}
      <SessionRowActions
        pinned={pinned}
        running={running}
        canStop={canStop}
        canDescribe={canDescribe}
        marathon={marathon}
        onToggleMarathon={onToggleMarathon}
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
