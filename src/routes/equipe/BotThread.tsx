import { ChatPanel } from '../../components/Chat';
import type { ChatPanelProps } from '../../components/chat/chat-panel-props';
import { Mascot } from '../../components/team/Mascot';
import { MascotStatusLine } from '../../components/team/MascotStatusLine';
import { Button } from '../../components/primitives';
import type { BotView } from './team-view';

// A bot has one continuous thread: no "new session" and no handoff into another one.
const noop = () => {};

interface BotThreadProps {
  view: BotView;
  chatProps: ChatPanelProps;
  onBack?: () => void;
  onProfile?: () => void;
}

export function BotThread({ view, chatProps, onBack, onProfile }: BotThreadProps) {
  const { bot, state, startedAt } = view;
  const live = state === 'thinking' || state === 'working';
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        {onBack && <Button variant="ghost" size="sm" icon="chevronLeft" square aria-label="Voltar pra equipe" onClick={onBack} />}
        <button type="button" onClick={onProfile} disabled={!onProfile}
          className="mx-auto flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 py-1 pl-1.5 pr-3.5 text-[14px] font-medium text-neutral-100">
          <Mascot mascot={bot.mascot} state={state} size={24} name={bot.name} />
          {bot.name}
        </button>
        {onBack && <span className="w-8" />}
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel
          key={chatProps.session?.id ?? 'none'}
          {...chatProps}
          onNew={noop}
          onHandoff={undefined}
          turnStatus={<MascotStatusLine active={live} startedAt={startedAt} />}
        />
      </div>
    </div>
  );
}
