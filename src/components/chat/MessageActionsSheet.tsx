import { Sheet } from '../primitives/Sheet';
import { Icon, tokens } from '../primitives';
import type { IconName } from '../primitives/Icon';

export interface MessageAction {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
}

interface MessageActionsSheetProps {
  open: boolean;
  onClose: () => void;
  actions: MessageAction[];
}

// Touch replacement for the inline action row: hold a message to get one
// 44px-per-row sheet instead of five 12px buttons under every bubble.
export function MessageActionsSheet({ open, onClose, actions }: MessageActionsSheetProps) {
  return (
    <Sheet
      open={open} onClose={onClose} label="Ações da mensagem"
      content={
        <ul className="flex flex-col">
          {actions.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => { onClose(); a.run(); }}
                className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] text-neutral-100 hover:bg-neutral-800 ${tokens.focusRing}`}
              >
                <Icon name={a.icon} size={16} className="text-neutral-400" />
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      }
    >
      <span />
    </Sheet>
  );
}
