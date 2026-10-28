import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

const TONE: Record<string, string> = {
  [RUNNING_LABEL]: 'text-green-400/90',
  [WAITING_LABEL]: 'text-violet-300',
};

export function SessionGroupHeader({ label, inset = false }: { label: string; count?: number; inset?: boolean }) {
  const box = inset ? 'px-2.5 pb-1 pt-1' : 'sticky top-0 z-1 -mx-2 bg-neutral-950 px-4.5 pb-1 pt-4';
  return (
    <div className={`text-[13px] font-medium tracking-wide ${box} ${TONE[label] ?? 'text-neutral-500'}`}>
      {label}
    </div>
  );
}
