import { monogram, tintFor } from '../cockpit/agents-view';

export function AgentAvatar({ id, name }: { id: string; name: string }) {
  return (
    <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-[16px] font-semibold ${tintFor(id)}`}>
      {monogram(name)}
    </span>
  );
}
