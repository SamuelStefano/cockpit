import { Icon, Badge } from '../primitives';
import { ExportMenu } from './ExportMenu';
import { TurnStat } from './TurnStat';
import { ContextMeter } from './ContextMeter';
import type { Session, Message } from '../../data/mock';
import type { TurnStats } from '../../../shared/protocol';

interface ChatHeaderProps {
  session: Session | null;
  messages: Message[];
  isEmpty: boolean;
  isMobile: boolean;
  contextTokens: number;
  lastTurn?: TurnStats;
  onNew: () => void;
  fullLoaded: boolean;
  truncated?: boolean;
  onOpenFull?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  setFullLoaded: (v: boolean) => void;
  onTerminal?: () => void;
  terminalRunning?: boolean;
}

export function ChatHeader({ session, messages, isEmpty, isMobile, contextTokens, lastTurn, onNew, fullLoaded, truncated, onOpenFull, onOpenSummary, setFullLoaded, onTerminal, terminalRunning }: ChatHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-2.5">
      <Icon name="message" size={14} className="text-neutral-500" />
      <span className="truncate text-[12.5px] font-medium text-neutral-300">{session ? session.title : 'Nova sessão'}</span>
      {session?.hasTerminal && <Badge tone="green" dot className="ml-0.5">terminal</Badge>}
      {/* Cluster direito num só container: vários ml-auto irmãos se espalham
          (margens auto dividem o espaço livre); aqui só este wrapper empurra. */}
      <div className="ml-auto flex items-center gap-2">
        <TurnStat stats={lastTurn} />
        {!isMobile && <ContextMeter tokens={contextTokens} onNew={onNew} />}
        {!isEmpty && session && !session.id.startsWith('new-') && onOpenFull && (
          <button
            onClick={() => {
              if (fullLoaded) { setFullLoaded(false); onOpenSummary?.(session.id); }
              else { setFullLoaded(true); onOpenFull(session.id); }
            }}
            title={fullLoaded
              ? 'Histórico completo carregado. Clique para voltar à visão resumida (só as mensagens recentes).'
              : truncated
                ? 'Esta sessão é longa: só as mensagens mais recentes foram carregadas. Clique para carregar o histórico completo (inclui anteriores a um /compact).'
                : 'Recarrega todas as mensagens do arquivo, inclusive as anteriores a um /compact que somem do caminho ativo'}
            className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] transition ${
              fullLoaded
                ? 'border-orange-700/60 bg-orange-500/10 text-orange-300 hover:border-orange-600 hover:text-orange-200'
                : truncated
                  ? 'border-amber-700/60 bg-amber-500/10 text-amber-300 hover:border-amber-600 hover:text-amber-200'
                  : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
            }`}
          >
            <Icon name={fullLoaded ? 'chevronUp' : 'message'} size={11} />
            {fullLoaded ? 'mostrar resumido' : truncated ? 'carregar antigas' : 'ver tudo'}
          </button>
        )}
        {!isEmpty && !isMobile && <ExportMenu title={session?.title || 'sessao'} messages={messages} />}
        {onTerminal && (
          <button
            onClick={onTerminal}
            title="Abrir terminais"
            className="relative flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition hover:border-neutral-700 hover:text-orange-300"
          >
            <Icon name="terminal" size={14} />
            {terminalRunning && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-green-500" style={{ boxShadow: '0 0 6px var(--ok)' }} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
