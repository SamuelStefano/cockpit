import { Button, Icon, Input } from '../../components/primitives';
import { useAddTask } from './useAddTask';

export function AddTaskRow({ onAdd }: { onAdd: (title: string, points: number) => void }) {
  const a = useAddTask(onAdd);
  return (
    <form onSubmit={a.submit} className="flex items-center gap-2 px-2.5 py-1.5">
      <Icon name="plus" size={12} className="shrink-0 text-neutral-600" />
      <Input size="sm" value={a.title} onChange={(e) => a.setTitle(e.target.value)} placeholder="nova task"
        aria-label="Título da nova task" bare />
      <Input size="sm" value={a.points} onChange={(e) => a.setPoints(e.target.value)} placeholder="pt" inputMode="decimal"
        aria-label="Pontos da nova task" bare mono className="w-14! shrink-0 text-right" />
      <Button type="submit" variant="ghost" size="sm" disabled={!a.valid} className="shrink-0">adicionar</Button>
    </form>
  );
}
