import type { ReactNode } from 'react';
import { Icon, tokens } from '../primitives';
import { BottomSheet } from '../primitives/Sheet';
import { AgentAvatar } from '../chrome/rail/AgentAvatar';
import type { AgentSwitch } from './chat-panel-props';

interface AgentSwitchSheetProps extends AgentSwitch {
  onClose: () => void;
}

function Row({ selected, onClick, lead, name }: { selected: boolean; onClick: () => void; lead: ReactNode; name: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-current={selected ? 'true' : undefined}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left ${selected ? 'bg-neutral-800/70' : 'hover:bg-neutral-900'} ${tokens.focusRing}`}
    >
      {lead}
      <span className="min-w-0 flex-1 truncate text-[15px] text-neutral-100">{name}</span>
      {selected && <Icon name="check" size={16} className="shrink-0 text-orange-400" />}
    </button>
  );
}

export function AgentSwitchSheet({ views, activeId, onOpen, onFree, onClose }: AgentSwitchSheetProps) {
  const pick = (run: () => void) => () => { onClose(); run(); };
  return (
    <BottomSheet
      onClose={onClose} label="Trocar agente"
      content={
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[12px] font-medium text-neutral-500">Trocar agente</p>
          <Row
            selected={activeId === null} onClick={pick(onFree)} name="Conversa livre"
            lead={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-neutral-200"><Icon name="message" size={17} /></span>}
          />
          {views.map((v) => (
            <Row key={v.bot.id} selected={v.bot.id === activeId} onClick={pick(() => onOpen(v.bot.id))} name={v.bot.name} lead={<AgentAvatar view={v} size={36} />} />
          ))}
        </div>
      }
    />
  );
}
