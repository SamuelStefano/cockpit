import { Button } from '../../components/primitives';
import { NewRoutine } from './rotinas/NewRoutine';
import { RoutineHistory } from './rotinas/RoutineHistory';
import { RoutineRow } from './rotinas/RoutineRow';
import type { Rotinas } from './rotinas/useRotinas';

interface BotRoutinesProps {
  botId: string;
  r: Rotinas;
  onChat: (botId: string) => void;
}

export function BotRoutines({ botId, r, onChat }: BotRoutinesProps) {
  return (
    <div>
      <div className="hairline overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
        {r.routines.map((c) => (
          <RoutineRow key={c.id} routine={c} bots={r.bots} now={r.now} compact onToggle={() => r.toggle(c)} onRun={() => r.run(c.id)}
            onEdit={() => r.openEdit(c)} onChat={onChat} onDelete={() => r.remove(c.id)} />
        ))}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 text-[13px] text-neutral-500">
            {r.routines.length === 0 ? 'Rotinas são tarefas que este agente faz sozinho. ' : ''}Nova rotina — descreva em palavras: "toda segunda às 8h, revisar o calendário"
          </span>
          <Button variant="secondary" size="sm" icon="plus" onClick={r.openNew}>Nova rotina</Button>
        </div>
      </div>
      {r.history.length > 0 && (
        <>
          <h2 className="mb-2 mt-7 text-[11px] uppercase tracking-[0.06em] text-neutral-500">Histórico</h2>
          <RoutineHistory items={r.history} bots={r.bots} onChat={onChat} onRun={r.run} />
        </>
      )}
      {r.modal && <NewRoutine bots={r.bots} now={r.now} editing={r.modal.editing} fixedBotId={botId} onClose={r.close} onSubmit={r.save} />}
    </div>
  );
}
