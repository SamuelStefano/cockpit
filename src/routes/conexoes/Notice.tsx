import { Button, Icon } from '../../components/primitives';

export function Notice({ title, body, short, onResolve }: { title: string; body: string; short?: string; onResolve: () => void }) {
  return (
    <div role="status" className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3.5 py-2.5 text-[13px] text-neutral-300 max-lg:mb-3 max-lg:min-h-11 max-lg:py-1.5 lg:flex-wrap">
      <Icon name="alertTriangle" size={16} className="shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1 max-lg:truncate">
        <b className="font-medium text-neutral-100">{title}</b>{' '}
        <span className="max-lg:hidden">{body}</span>
        {short && <span className="text-neutral-400 lg:hidden">{short}</span>}
      </span>
      <Button size="sm" variant="secondary" onClick={onResolve}>Resolver</Button>
    </div>
  );
}
