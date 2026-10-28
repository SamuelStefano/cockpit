import type { Message } from '../../data/types';
import type { TurnStats } from '../../../shared/protocol';
import { ExportMenu } from './ExportMenu';
import { HistoryControls } from './HistoryControls';
import { prettyModel, turnStatParts } from './toolbar-format';
import { Icon, Menu, MenuItem, MenuSeparator } from '../primitives';

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
  pause?: { paused: boolean; onSet: (paused: boolean) => void };
  contextPct?: number | null;
  onRename?: () => void;
  onDelete?: () => void;
  onDone: () => void;
  // Phone: the header keeps only the essentials, the rest lives here.
  phone?: { usage?: { text: string; hot: boolean }; onTerminal?: () => void; terminalOpen?: boolean; onRestart?: () => void };
}

export function ChatHeaderMenu({ title, messages, lastTurn, ranOn, selectedModel, history, canExport, profile, pause, contextPct = null, onRename, onDelete, onDone, phone }: ChatHeaderMenuProps) {
  const turn = turnStatParts(lastTurn);
  const turns = lastTurn?.numTurns ? ` · ${lastTurn.numTurns} turno${lastTurn.numTurns === 1 ? '' : 's'}` : '';
  const hasActions = !!onRename || canExport || !!history;
  return (
    <Menu label="Mais ações da conversa" className="w-72" >
      <div className="contents" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) onDone(); }}>
        {contextPct !== null && (
          <>
            <div className="flex items-center gap-3 px-2.5 py-2 text-[12px] text-neutral-500">
              <span>Contexto</span>
              <span role="meter" aria-label={`Contexto ${contextPct}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={contextPct} className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-800">
                <span className="block h-full rounded-full bg-neutral-500" style={{ width: `${Math.min(100, contextPct)}%` }} />
              </span>
              <span className="tabular-nums">{contextPct}%</span>
            </div>
            <MenuSeparator />
          </>
        )}
        {phone?.usage && (
          <p className={`flex items-center gap-2.5 px-2.5 py-2 text-[13px] ${phone.usage.hot ? 'text-amber-300' : 'text-neutral-300'}`}>
            <Icon name="clock" size={14} className="text-neutral-400" />
            <span>{phone.usage.text}</span>
          </p>
        )}
        {phone?.onRestart && <MenuItem icon="rotate" label="Recomeçar com contexto limpo" onClick={phone.onRestart} />}
        {phone?.onTerminal && <MenuItem icon="terminal" label="Abrir terminais" aria-pressed={phone.terminalOpen} onClick={phone.onTerminal} />}
        {profile && <MenuItem icon="user" label="Perfil do agente" aria-pressed={profile.open} onClick={profile.toggle} />}
        {pause && <MenuItem icon={pause.paused ? 'play' : 'pause'} label={pause.paused ? 'Retomar agentes' : 'Pausar agentes'} aria-pressed={pause.paused} onClick={() => pause.onSet(!pause.paused)} />}
        {onRename && <MenuItem icon="pencil" label="Renomear" onClick={onRename} />}
        {canExport && <ExportMenu title={title} messages={messages} />}
        {history && <HistoryControls {...history} />}
        {(turn || ranOn) && hasActions && <MenuSeparator />}
        {turn && (
          <p title="Último turno (custo real do CLI)" className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-neutral-300">
            <Icon name="clock" size={14} className="text-neutral-400" />
            <span>Último turno</span>
            <span className="ml-auto text-[12px] tabular-nums text-neutral-500">{turn.parts.join(' · ')}{turn.model ? ` · ${turn.model}` : ''}{turns}</span>
          </p>
        )}
        {ranOn && (
          <p className="px-2.5 py-1.5 text-[12px] text-amber-300/90">
            rodou em {prettyModel(ranOn)}, não em {prettyModel(selectedModel)}
          </p>
        )}
        {onDelete && (
          <>
            <MenuSeparator />
            <MenuItem icon="trash" label="Apagar conversa" danger onClick={onDelete} />
          </>
        )}
      </div>
    </Menu>
  );
}
