import { Icon, tokens } from '../primitives';

// Six actions side by side do not fit a phone row: there only edit and remove show
// until the row is long-pressed (`extended`).
const iconBtn = `flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30 ${tokens.focusRing} ${tokens.touchBox}`;

interface Props {
  editing: boolean;
  first: boolean;
  last: boolean;
  nowBlocked: boolean;
  bgOpen: boolean;
  bgId: string;
  extended: boolean;
  onCommit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onRunNow: () => void;
  onToggleBg: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

export function QueuedItemActions({ editing, first, last, nowBlocked, bgOpen, bgId, extended, onCommit, onCancelEdit, onStartEdit, onRunNow, onToggleBg, onMove, onRemove }: Props) {
  return (
        <div className="flex shrink-0 items-center pointer-coarse:w-full pointer-coarse:justify-end">
          {editing ? (
            <>
              <button type="button" onClick={onCommit} title="Salvar (Enter)" className={iconBtn}>
                <Icon name="check" size={12} />
              </button>
              <button type="button" onClick={onCancelEdit} title="Descartar a edição (Esc)" className={iconBtn}>
                <Icon name="x" size={12} />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onStartEdit} title="Editar esta mensagem na fila" className={iconBtn}>
                <Icon name="pencil" size={12} />
              </button>
              {extended && <>
              <button type="button" onClick={onRunNow} disabled={nowBlocked} title="Rodar agora neste chat, interrompendo o turno em andamento" className={iconBtn}>
                <Icon name="play" size={11} />
              </button>
              <button type="button" onClick={onToggleBg} aria-expanded={bgOpen} aria-controls={bgId} title="Rodar agora em paralelo, com o contexto deste chat" className={`${iconBtn} ${bgOpen ? 'text-orange-300' : ''}`}>
                <Icon name="zap" size={12} />
              </button>
              <button type="button" onClick={() => onMove(-1)} disabled={first} title="Subir na fila" className={iconBtn}>
                <Icon name="chevronUp" size={12} />
              </button>
              <button type="button" onClick={() => onMove(1)} disabled={last} title="Descer na fila" className={iconBtn}>
                <Icon name="chevronDown" size={12} />
              </button>
              </>}
              <button type="button" onClick={onRemove} title="Cancelar esta mensagem na fila" className={iconBtn}>
                <Icon name="x" size={12} />
              </button>
            </>
          )}
        </div>
  );
}
