import { useMemo } from 'react';
import { ChatPanel } from '../../components/Chat';
import type { ChatBotDecor, ChatPanelProps } from '../../components/chat/chat-panel-props';
import { Mascot } from '../../components/team/Mascot';
import { LivingPhrase } from '../../components/team/LivingPhrase';
import { TeamWorkingCard } from '../../components/team/TeamWorkingCard';
import { teamIsWorking, teamRows } from '../../components/team/team-working';
import { useTeamPresence } from '../../components/team/useTeamPresence';
import { ThreadEvent } from '../../components/chat/ThreadEvent';
import { routineEvents } from './thread-events';
import { ImageResolverContext } from '../../components/primitives';
import { botImageResolver } from './bot-image';
import type { BotFilesApi } from './equipe-props';
import type { Cron, TeamBot } from '../../../shared/protocol';
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
  files: Pick<BotFilesApi, 'botFileData' | 'onBotFileGet'>;
  onProfile?: () => void;
  profileOpen?: boolean;
  pause?: { paused: boolean; onSet: (paused: boolean) => void };
  views?: BotView[];
  crons?: Cron[];
}

export function BotThread({ view, chatProps, bots, log, files, onProfile, profileOpen, pause, views, crons }: BotThreadProps) {
  const { bot, state, startedAt } = view;
  const live = state === 'thinking' || state === 'working';
  const computer = useComputer();
  const { byId, groups } = useBotTraffic(bot.id, bots, log, chatProps.messages);
  // The header parts are memoized on their own inputs: a fresh botDecor on every
  // streamed delta would re-render every message row of the thread.
  const hasComputer = !!computer;
  const togglePreview = computer?.togglePreview;
  const status = useMemo(
    () => hasComputer && <ComputerStatusButton active={!!computer?.active} pressed={!!computer?.previewOpen} onClick={() => togglePreview?.()} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasComputer, computer?.active, computer?.previewOpen],
  );
  const rows = useMemo(() => (bot.primary && views ? teamRows(views, bot.id) : []), [bot.primary, bot.id, views]);
  const presence = useTeamPresence(rows.length > 0 && teamIsWorking(rows));
  const rowsKey = rows.map((r) => `${r.bot.id}:${r.state}:${r.startedAt ?? ''}:${r.endedAt ?? ''}`).join('|');
  const teamNode = useMemo(
    () => (presence === 'hidden' ? null : <TeamWorkingCard rows={rows} leaving={presence === 'leaving'} />),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presence, rowsKey],
  );
  const events = useMemo(() => routineEvents(crons ?? [], bot.id).map((e) => ({ key: e.key, ts: e.ts, node: <ThreadEvent>{e.node}</ThreadEvent> })), [crons, bot.id]);
  const avatar = useMemo(() => <Mascot mascot={bot.mascot} size={28} name={bot.name} />, [bot.mascot, bot.name]);
  const botDecor = useMemo<ChatBotDecor>(() => ({
    name: bot.name,
    avatar,
    empty: <BotThreadEmpty name={bot.name} />,
    hideMessage: isTeamPromptMessage,
    extras: [
      ...(teamNode ? [{ key: 'team-working', ts: 0, node: teamNode }] : []),
      ...events,
      ...groups.map((g) => ({
        key: `t-${g.key}`,
        ts: g.ts,
        node: <TrafficMarker group={g} byId={byId} onQuote={chatProps.onQuote} />,
      })),
    ],
    header: { avatar: <Mascot mascot={bot.mascot} state={state} size={24} name={bot.name} />, actions: status, onProfile, profileOpen, pause },
  }), [bot.id, bot.name, bot.mascot, avatar, state, status, onProfile, profileOpen, pause, groups, byId, chatProps.onQuote, teamNode, events]);
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
          turnStatus={<LivingPhrase live active={live} startedAt={startedAt} className="px-4 pb-2 text-[13px] text-neutral-500" />}
        />
      </ImageResolverContext.Provider>
    </div>
  );
  return (
    <div className="flex h-full min-w-0 flex-col">
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
