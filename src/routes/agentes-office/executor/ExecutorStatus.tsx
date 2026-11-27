import type { ExecutorState } from '../../../../shared/heavy-job';
import { EXECUTOR_ACCENT, NOT_CONFIGURED_HINT, checkedAgo, stalledMinutes, stateLabel } from './executor-view';

interface ExecutorStatusProps { state: ExecutorState; now: number }

export function ExecutorStatus({ state, now }: ExecutorStatusProps) {
  const tone = !state.configured || state.online === null ? '#a3a3a3' : state.online ? '#4ade80' : '#f87171';
  const stalled = stalledMinutes(state, now);
  const ago = checkedAgo(state, now);
  return (
    <section aria-label="Status do executor" className="flex min-w-0 flex-col gap-2 rounded-xl border p-3.5" style={{ borderColor: `${EXECUTOR_ACCENT}40`, background: `${EXECUTOR_ACCENT}10` }}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />
        <h2 className="min-w-0 break-words text-[16px] font-semibold text-neutral-50">{state.configured ? state.label : 'Executor'}</h2>
        <span className="rounded-full border px-2 py-px text-[11.5px] font-medium" style={{ color: tone, borderColor: `${tone}55`, background: `${tone}1f` }}>{stateLabel(state)}</span>
        {ago && <span className="text-[12px] text-neutral-500">{ago}</span>}
      </div>
      {!state.configured && <p className="text-[13px] text-neutral-400">{NOT_CONFIGURED_HINT}</p>}
      {stalled !== null && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13.5px] text-amber-300">
          Há {stalled} min esperando o executor ligar. Os jobs seguem na fila e rodam assim que ele voltar.
        </p>
      )}
    </section>
  );
}
