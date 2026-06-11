import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../primitives';
import type { IconName } from '../primitives/Icon';
import { shouldDropUp } from './menu-flip';

interface SessionRowActionsProps {
  pinned: boolean;
  running: boolean;
  canStop: boolean;
  canDescribe: boolean;
  onTogglePin?: () => void;
  onRename: () => void;
  onDescribe: () => void;
  onStop?: () => void;
  onArchive: () => void;
  onDelete: () => void;
  // Abertura controlada de fora (ex: long-press no card em mobile). Se omitido, o
  // menu controla o próprio estado via o botão de grip.
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

interface Item {
  key: string;
  label: string;
  icon: IconName;
  run: () => void;
  danger?: boolean;
}

export function SessionRowActions({ pinned, running, canStop, canDescribe, onTogglePin, onRename, onDescribe, onStop, onArchive, onDelete, open: openProp, onOpenChange }: SessionRowActionsProps) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (v: boolean) => { onOpenChange ? onOpenChange(v) : setOpenInternal(v); };
  const ref = useRef<HTMLDivElement>(null);
  const [dropUp, setDropUp] = useState(false);

  // Layout effect: mede e decide o lado ANTES do paint — sem flash do menu
  // abrindo pro lado errado por um frame.
  useLayoutEffect(() => {
    if (open && ref.current) setDropUp(shouldDropUp(ref.current.getBoundingClientRect().bottom, window.innerHeight));
  }, [open]);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setOpen(false); } };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const items: Item[] = [];
  if (onTogglePin) items.push({ key: 'pin', label: pinned ? 'Desafixar' : 'Favoritar', icon: 'star', run: onTogglePin });
  items.push({ key: 'rename', label: 'Renomear', icon: 'pencil', run: onRename });
  if (canDescribe) items.push({ key: 'desc', label: 'Editar descrição', icon: 'message', run: onDescribe });
  if (running && canStop && onStop) items.push({ key: 'stop', label: 'Parar turno', icon: 'square', run: onStop });
  items.push({ key: 'archive', label: 'Arquivar', icon: 'file', run: onArchive });
  items.push({ key: 'delete', label: 'Excluir', icon: 'trash', run: onDelete, danger: true });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title="Ações"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`rounded p-0.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200
          ${open ? 'bg-neutral-800 text-neutral-200' : 'block sm:hidden sm:group-hover:block'}`}
      >
        <Icon name="grip" size={14} />
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-0 z-20 w-44 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl shadow-black/40 ${dropUp ? 'bottom-[120%]' : 'top-[120%]'}`}
        >
          {items.map((it) => (
            <button
              key={it.key}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.run(); }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition
                ${it.danger
                  ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'}`}
            >
              <Icon name={it.icon} size={13} className="shrink-0" />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
