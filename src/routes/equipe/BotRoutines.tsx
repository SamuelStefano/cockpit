import { Button } from '../../components/primitives';
import { DetailField as Field } from './DetailField';
import { RoutineForm } from './RoutineForm';
import { RoutineRow } from './RoutineRow';
import type { BotRoutines as Routines } from './useBotRoutines';

export function BotRoutines({ r }: { r: Routines }) {
  return (
    <Field label="Rotinas">
      <div className="flex flex-col gap-2">
        {r.routines.length === 0 && !r.draft && <span className="text-neutral-600">Rotinas são tarefas recorrentes deste bot.</span>}
        {r.routines.map((c) => (
          <RoutineRow key={c.id} routine={c} now={r.now} onToggle={() => r.toggle(c)} onRun={() => r.run(c.id)} onDelete={() => r.remove(c.id)} />
        ))}
        {r.draft
          ? <RoutineForm draft={r.draft} error={r.error} set={r.set} onSubmit={r.submit} onCancel={r.cancel} />
          : <div><Button variant="secondary" size="sm" icon="plus" onClick={r.open}>Nova rotina</Button></div>}
      </div>
    </Field>
  );
}
