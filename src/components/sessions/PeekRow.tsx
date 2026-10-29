import type { SessionMeta } from '../../../shared/protocol';

export function PeekRow({ s, busy, onOpen }: { s: SessionMeta; busy: boolean; onOpen: () => void }) {
  return (
    <button
      type="button" onClick={onOpen} title={s.title || 'Sem título'}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-neutral-300 transition hover:bg-neutral-900 hover:text-neutral-100"
    >
      {busy
        ? <span role="img" aria-label="rodando" className="breathe h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
        : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.waiting ? 'bg-violet-400' : 'bg-neutral-700'}`} />}
      <span className="min-w-0 flex-1 truncate">{s.title || 'Sem título'}</span>
      {s.relative && <span className="shrink-0 text-[11.5px] text-neutral-600">{s.relative}</span>}
    </button>
  );
}
