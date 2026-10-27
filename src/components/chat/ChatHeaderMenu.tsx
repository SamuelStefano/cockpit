import type { Message } from '../../data/types';
import type { TurnStats } from '../../../shared/protocol';
import { ExportMenu } from './ExportMenu';
import { HistoryControls } from './HistoryControls';
import { TurnStat } from './TurnStat';
import { prettyModel } from './toolbar-format';
import { Icon } from '../primitives';

interface HistoryProps {
  sessionId: string;
  fullLoaded: boolean;
  truncated?: boolean;
  onOpenFull: (id: string) => void;
  onLoadOlder?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  setFullLoaded: (v: boolean) => void;
  beforeGrow?: () => void;
}

interface ChatHeaderMenuProps {
  title: string;
  messages: Message[];
  lastTurn?: TurnStats;
  ranOn: string | null;
  selectedModel?: string;
  history: HistoryProps | null;
  canExport: boolean;
  profile?: { open: boolean; toggle: () => void } | null;
  onDone: () => void;
  onTerminal?: () => void;
  terminalRunning?: boolean;
}

// Everything that used to be a badge in the bar: info as text, then the actions.
// A click on any action closes the menu (delegated: the row components stay dumb).
export function ChatHeaderMenu({ title, messages, lastTurn, ranOn, selectedModel, history, canExport, profile, onDone, onTerminal, terminalRunning }: ChatHeaderMenuProps) {
  return (
    <div className="w-64 py-1" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) onDone(); }}>
      {profile && (
        <button
          type="button" aria-pressed={profile.open} onClick={profile.toggle}
          className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] text-neutral-200 hover:bg-neutral-800 pointer-coarse:h-11"
        >
          <Icon name="user" size={15} className="text-neutral-400" />
          Perfil do agente
        </button>
      )}
      {onTerminal && (
        <button
          type="button" onClick={onTerminal}
          className="flex h-9 w-full items-center gap-2 px-3 text-left text-[13px] text-neutral-200 hover:bg-neutral-800 pointer-coarse:h-11"
        >
          <Icon name="terminal" size={15} className="text-neutral-400" />
          Terminais
          {terminalRunning && <span className="ml-auto h-2 w-2 rounded-full bg-green-500" />}
        </button>
      )}
      <TurnStat stats={lastTurn} />
      {ranOn && (
        <p className="px-3 py-1.5 text-[12px] text-amber-300/90">
          rodou em {prettyModel(ranOn)}, não em {prettyModel(selectedModel)}
        </p>
      )}
      {history && <HistoryControls {...history} />}
      {canExport && <ExportMenu title={title} messages={messages} />}
    </div>
  );
}
