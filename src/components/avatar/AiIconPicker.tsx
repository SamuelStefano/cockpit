import { Icon } from '../primitives';
import { AI_AVATARS } from '../aiAvatar';
import { ClaudeAvatar } from '../ClaudeAvatar';

interface AiIconPickerProps {
  open: boolean;
  onToggle: () => void;
  selected: string;
  onSelect: (id: string) => void;
}

export function AiIconPicker({ open, onToggle, selected, onSelect }: AiIconPickerProps) {
  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
      >
        <ClaudeAvatar size={18} />
        <span className="flex-1">Ícone da IA</span>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />
      </button>
      {open && (
        <div className="scroll-thin mt-2 grid max-h-40 grid-cols-5 gap-1.5 overscroll-contain overflow-y-auto sm:grid-cols-6">
          {AI_AVATARS.map((a) => {
            const on = a.id === selected;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                title={a.label}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-neutral-950 transition ${on ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-neutral-900' : 'hover:scale-110'}`}
                style={{ background: a.bg }}
              >
                {a.emoji ? <span style={{ fontSize: 15, lineHeight: 1 }}>{a.emoji}</span> : <Icon name="claude" size={15} stroke={2.2} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
