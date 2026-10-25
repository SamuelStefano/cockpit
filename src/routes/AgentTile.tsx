import type { CSSProperties } from 'react';
import { Badge, ProgressBar, tokens } from '../components/primitives';
import { Bit } from '../components/bit/Bit';
import { STATUS_LABEL, STATUS_TONE, STEP_COUNT, bitStateForAgent, progressFor, type AgentCardModel } from '../cockpit/agents-view';
import { AgentAvatar } from './AgentAvatar';
import './agents.css';

interface AgentTileProps {
  card: AgentCardModel;
  index: number;
  selected: boolean;
  testing: boolean;
  celebrating: boolean;
  onSelect: () => void;
}

export function AgentTile({ card, index, selected, testing, celebrating, onSelect }: AgentTileProps) {
  const { preset, item, status } = card;
  const done = progressFor(status, !!item);
  const segments = Array.from({ length: STEP_COUNT }, (_, i) => ({
    value: 1, tone: i < done ? (done === STEP_COUNT ? 'green' : 'orange') : 'track',
  } as const));
  const style = { order: index * 2, animationDelay: `${index * 40}ms` } as CSSProperties;
  return (
    <button
      type="button" aria-pressed={selected} onClick={onSelect} style={style}
      className={`agent-tile flex flex-col gap-3 rounded-xl border p-3.5 text-left ${tokens.focusRing} ${selected ? `border-orange-500/40 bg-neutral-900 ${tokens.insetRing.accent}` : 'hairline border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-900'}`}
    >
      <span className="flex items-center gap-3">
        <AgentAvatar id={preset.id} name={preset.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-neutral-100">{preset.name}</span>
          <span className="block truncate text-[11.5px] text-neutral-500">{preset.vendor}</span>
        </span>
        <Badge tone={testing ? 'orange' : STATUS_TONE[status]} className="gap-1.5 py-0.5 pl-1">
          <Bit state={bitStateForAgent(status, testing, celebrating)} size={16} title={STATUS_LABEL[status]} />
          {testing ? 'Testando…' : item ? STATUS_LABEL[status] : 'Adicionar'}
        </Badge>
      </span>
      <ProgressBar size="xs" segments={segments.map((s, i) => ({ ...s, label: preset.steps[i]?.title }))} />
    </button>
  );
}
