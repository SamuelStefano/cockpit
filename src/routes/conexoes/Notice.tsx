import { Button, Icon } from '../../components/primitives';

export function Notice({ title, body, onResolve }: { title: string; body: string; onResolve: () => void }) {
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3.5 py-2.5 text-[13px] text-neutral-300">
      <Icon name="alertTriangle" size={16} className="shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1"><b className="font-medium text-neutral-100">{title}</b> {body}</span>
      <Button size="sm" variant="secondary" onClick={onResolve}>Resolver</Button>
    </div>
  );
}
