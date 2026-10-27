import type { Message } from '../../data/types';
import type { TurnStats } from '../../../shared/protocol';
import { ExportMenu } from './ExportMenu';
import { HistoryControls } from './HistoryControls';
import { TurnStat } from './TurnStat';
import { prettyModel } from './toolbar-format';

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
  onDone: () => void;
}

// Everything that used to be a badge in the bar: info as text, then the actions.
// A click on any action closes the menu (delegated: the row components stay dumb).
export function ChatHeaderMenu({ title, messages, lastTurn, ranOn, selectedModel, history, canExport, onDone }: ChatHeaderMenuProps) {
  return (
    <div className="w-64 py-1" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) onDone(); }}>
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
