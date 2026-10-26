import { useMemo } from 'react';
import { ChatPanel } from '../../components/Chat';
import type { ChatBotDecor, ChatPanelProps } from '../../components/chat/chat-panel-props';
import { Mascot } from '../../components/team/Mascot';
import { MascotStatusLine } from '../../components/team/MascotStatusLine';
import { Button, ImageResolverContext } from '../../components/primitives';
import { botImageResolver } from './bot-image';
import type { BotFilesApi } from './equipe-props';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import type { BotView } from './team-view';
import { BotThreadEmpty } from './BotThreadEmpty';
import { TrafficMarker } from './TrafficMarker';
import { isTeamPromptMessage } from './team-thread';
import { useBotTraffic } from './useBotTraffic';
import { useComputer } from './computer-context';
import { ComputerStatusButton } from './ComputerStatusButton';
import { ComputerPreviewPane } from './ComputerPreviewPane';
import { SelectionQuote } from './SelectionQuote';

const noop = () => {};

interface BotThreadProps {
  view: BotView;
  chatProps: ChatPanelProps;
  bots: TeamBot[];
  log: TeamMessage[];
  onOpenPeer: (peerId: string) => void;
  files: Pick<BotFilesApi, 'botFileData' | 'onBotFileGet'>;
  onBack?: () => void;
  onProfile?: () => void;
}

export function BotThread({ view, chatProps, bots, log, files, onOpenPeer, onBack, onProfile }: BotThreadProps) {
  const { bot, state, startedAt } = view;
  const live = state === 'thinking' || state === 'working';
  const computer = useComputer();
  const { byId, groups } = useBotTraffic(bot.id, bots, log, chatProps.messages);
  const botDecor = useMemo<ChatBotDecor>(() => ({
    name: bot.name,
    avatar: <Mascot mascot={bot.mascot} size={28} name={bot.name} />,
    empty: <BotThreadEmpty name={bot.name} />,
    hideMessage: isTeamPromptMessage,
    extras: groups.map((g) => ({
      key: `t-${g.key}`,
      ts: g.ts,
      node: <TrafficMarker group={g} botId={bot.id} byId={byId} onOpen={onOpenPeer} onQuote={chatProps.onQuote} />,
    })),
  }), [bot.id, bot.name, bot.mascot, groups, byId, onOpenPeer, chatProps.onQuote]);
  const images = useMemo(() => botImageResolver(bot.id, files.botFileData, files.onBotFileGet), [bot.id, files.botFileData, files.onBotFileGet]);
  const showDock = !!computer && computer.previewOpen && !computer.takenOver;
  const ok = computer?.data?.status === 'ok' ? computer.data.computer : null;
  const chat = (
    <div className="min-h-0 flex-1">
      <ImageResolverContext.Provider value={images}>
        <ChatPanel
          key={chatProps.session?.id ?? 'none'}
          {...chatProps}
          {...(bot.model ? { model: bot.model, modelLocked: 'fixado no bot' } : {})}
          onNew={noop}
          onHandoff={undefined}
          botDecor={botDecor}
          turnStatus={<MascotStatusLine active={live} startedAt={startedAt} />}
        />
      </ImageResolverContext.Provider>
    </div>
  );
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        {onBack && <Button variant="ghost" size="sm" icon="chevronLeft" square aria-label="Voltar pra equipe" onClick={onBack} />}
        <button type="button" onClick={onProfile} disabled={!onProfile}
          className="mx-auto flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 py-1 pl-1.5 pr-3.5 text-[14px] font-medium text-neutral-100">
          <Mascot mascot={bot.mascot} state={state} size={24} name={bot.name} />
          {bot.name}
        </button>
        {computer && <ComputerStatusButton active={computer.active} pressed={computer.previewOpen} onClick={computer.togglePreview} />}
        {onBack && <span className="w-8" />}
      </div>
      <div className={`min-h-0 flex-1 ${showDock && !computer?.isMobile ? 'flex' : 'flex flex-col'}`}>
        {chatProps.onQuote ? <SelectionQuote onQuote={chatProps.onQuote}>{chat}</SelectionQuote> : chat}
        {showDock && ok && (
          <ComputerPreviewPane
            cwd={ok.cwd} files={ok.files} bytes={ok.bytes} truncated={ok.truncated}
            state={state} preview={ok.preview} termAlive={ok.termAlive}
            isAdmin={computer.isAdmin} isMobile={computer.isMobile}
            canTake={computer.connected && computer.isAdmin}
            onTakeOver={computer.takeOver} onClose={computer.closePreview}
            onRefresh={computer.refresh} connected={computer.connected}
          />
        )}
      </div>
    </div>
  );
}
