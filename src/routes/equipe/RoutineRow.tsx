import type { Cron } from '../../../shared/protocol';
import { Button, Switch, toast, tokens } from '../../components/primitives';
import { useArmed } from '../../components/primitives/useArmed';
import { routineScheduleLabel, routineStatusLabel } from './routine-format';

interface RoutineRowProps {
  routine: Cron;
  now: number;
  onToggle: () => void;
  onRun: () => void;
  onDelete: () => void;
}

export function RoutineRow({ routine, now, onToggle, onRun, onDelete }: RoutineRowProps) {
  const del = useArmed();
  const run = () => { onRun(); toast('Rotina disparada'); };
  return (
    <div className="flex items-center gap-1" title={routine.prompt}>
      <div className="min-w-0 flex-1">
        <Switch checked={routine.enabled} onChange={onToggle} label={routine.name}
          hint={`${routineScheduleLabel(routine.schedule)} · ${routineStatusLabel(routine, now)}`} />
      </div>
      <Button variant="ghost" size="sm" icon="play" title="Rodar agora" aria-label="Rodar agora" className={tokens.touchBox} onClick={run} />
      {del.armed
        ? <Button variant="danger" size="sm" className={tokens.touchBox} title="Confirmar exclusão" onClick={() => del.fire(onDelete)}>apagar?</Button>
        : <Button variant="ghost" size="sm" icon="trash" title="Apagar rotina" aria-label="Apagar rotina" className={tokens.touchBox} onClick={() => del.fire(onDelete)} />}
    </div>
  );
}
