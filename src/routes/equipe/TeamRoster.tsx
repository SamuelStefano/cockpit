import { Button, EmptyState, SkeletonCards } from '../../components/primitives';
import { BotRow } from './BotRow';
import { PrimaryCard } from './PrimaryCard';
import type { BotView } from './team-view';

interface TeamRosterProps {
  views: BotView[];
  loaded: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  paused: boolean;
  onPauseSet: (paused: boolean) => void;
}

export function TeamRoster({ views, loaded, selectedId, onSelect, onNew, paused, onPauseSet }: TeamRosterProps) {
  const primary = views.find((v) => v.bot.primary);
  const rest = views.filter((v) => v !== primary);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h1 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">Equipe</h1>
        <div className="flex items-center gap-1">
          <Button variant={paused ? 'outline' : 'ghost'} size="xs" icon={paused ? 'play' : 'pause'} aria-pressed={paused}
            title={paused ? 'Bots voltam a trocar mensagens' : 'Congela as mensagens entre bots (as novas ficam bloqueadas)'}
            onClick={() => onPauseSet(!paused)}>
            {paused ? 'Retomar equipe' : 'Pausar equipe'}
          </Button>
          <Button variant="ghost" size="sm" icon="plus" square aria-label="Novo bot" title="Novo bot" onClick={onNew} />
        </div>
      </div>
      {paused && <p className="px-3 pb-2 text-[13px] text-yellow-400/90">Equipe pausada: mensagens entre bots ficam bloqueadas.</p>}
      {!loaded ? (
        <div className="p-3"><SkeletonCards /></div>
      ) : views.length === 0 ? (
        <EmptyState icon="user" title="Sem bots ainda" description="Crie o primeiro bot da equipe: ele vira o principal e conversa com você numa thread só.">
          <Button variant="primary" icon="plus" onClick={onNew}>Criar bot</Button>
        </EmptyState>
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-3">
          {primary && <div className="pb-3 pt-1"><PrimaryCard view={primary} selected={primary.bot.id === selectedId} onSelect={onSelect} /></div>}
          <div className="flex flex-col gap-0.5">
            {rest.map((v) => <BotRow key={v.bot.id} view={v} selected={v.bot.id === selectedId} onSelect={onSelect} />)}
          </div>
        </div>
      )}
    </div>
  );
}
