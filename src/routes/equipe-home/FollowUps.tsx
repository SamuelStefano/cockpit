import type { TeamState } from '../../../shared/team-state';
import { Button } from '../../components/primitives';
import { monogram, tintFor } from '../../cockpit/agents-view';
import { ago, followUpKey, nameOf } from './team-home';

const NO_SESSION = 'bot sem sessão';

interface Props {
  state: TeamState;
  clock: number;
  failedNudge: string | null;
  hasSession: (id: string) => boolean;
  onNudge: (index: number) => void;
}

export function FollowUps({ state, clock, failedNudge, hasSession, onNudge }: Props) {
  const n = state.followUps.length;
  return (
    <section role="alert" className="mb-6">
      <p className="mb-2 text-[13px] font-semibold text-red-400">{n} {n === 1 ? 'pedido sem resposta' : 'pedidos sem resposta'}</p>
      <ul className="overflow-hidden rounded-xl border border-red-500/30 bg-red-500/5">
        {state.followUps.map((f, i) => (
          <li key={followUpKey(f)} className="flex items-center gap-3 border-b border-neutral-800/70 px-4 py-3 last:border-b-0">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold ${tintFor(f.to)}`}>{monogram(nameOf(state, f.to))}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-neutral-200">{nameOf(state, f.from)} → {nameOf(state, f.to)} {ago(clock - f.at)}</span>
            {failedNudge === followUpKey(f) && <span role="status" className="text-[12px] text-red-400">não enviado</span>}
            <span title={hasSession(f.to) ? undefined : NO_SESSION}>
              <Button size="sm" variant="primary" disabled={!hasSession(f.to)} title={hasSession(f.to) ? undefined : NO_SESSION} onClick={() => onNudge(i)}>Cobrar</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
