import { Button, EmptyState, Skeleton } from '../../components/primitives';
import type { TeamBot } from '../../../shared/protocol';
import { useLoadStalled } from '../../lib/useLoadStalled';
import { NewRoutine } from './rotinas/NewRoutine';
import { RoutineHistory } from './rotinas/RoutineHistory';
import { RoutineRow } from './rotinas/RoutineRow';
import { failureCard, nextCard, weekCard, type SummaryCard } from './rotinas/routine-view';
import type { Rotinas as RotinasState } from './rotinas/useRotinas';

interface RotinasProps {
  r: RotinasState;
  bots: TeamBot[];
  loaded: boolean;
  connected: boolean;
  isAdmin: boolean;
  onChat: (botId: string) => void;
  onReload: () => void;
}

function Card({ card }: { card: SummaryCard }) {
  return (
    <div className="hairline min-w-0 flex-1 rounded-xl border border-neutral-800 bg-neutral-900/50 px-3.5 py-3">
      <b className="block truncate text-[14px] font-medium text-neutral-100">{card.title}</b>
      <span className={`mt-0.5 block text-[12px] ${card.tone === 'err' ? 'text-red-400' : 'text-neutral-500'}`}>{card.sub}</span>
    </div>
  );
}

export function Rotinas({ r, bots, loaded, connected, isAdmin, onChat, onReload }: RotinasProps) {
  const { stalled, retry } = useLoadStalled(loaded, connected);
  if (!loaded) {
    return stalled
      ? <EmptyState size="sm" icon="x" title="Não deu pra carregar as rotinas" description="O servidor não respondeu. Tente de novo."><Button icon="rotate" onClick={() => { retry(); onReload(); }}>Tentar de novo</Button></EmptyState>
      : <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
  }
  const modal = r.modal;
  return (
    <>
      {r.routines.length === 0
        ? <EmptyState size="sm" icon="clock" title="Nenhuma rotina ainda" description="Rotina é uma tarefa que um agente faz sozinho, no horário que você disser.">
            {isAdmin && <Button icon="plus" onClick={r.openNew}>Nova rotina</Button>}
          </EmptyState>
        : <>
            <div className="mb-5 flex flex-col gap-2.5 md:flex-row" aria-label="Resumo">
              <Card card={nextCard(r.routines, bots, r.now)} />
              <Card card={failureCard(r.routines, r.now)} />
              <Card card={weekCard(r.routines, r.now)} />
            </div>
            <div className="hairline overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50">
              <div className="hidden h-9 grid-cols-[auto_minmax(0,1fr)_170px_160px_auto] items-center gap-x-3 border-b border-neutral-800/70 px-4 text-[11px] uppercase tracking-[0.06em] text-neutral-500 md:grid">
                <span className="w-8" /><span>Rotina</span><span>Quando</span><span>Última execução</span><span className="w-7" />
              </div>
              {r.routines.map((c) => (
                <RoutineRow key={c.id} routine={c} bots={bots} now={r.now} onToggle={() => r.toggle(c)} onRun={() => r.run(c.id)}
                  onEdit={() => r.openEdit(c)} onChat={onChat} onDelete={() => r.remove(c.id)} />
              ))}
            </div>
            <h2 className="mb-2 mt-7 text-[11px] uppercase tracking-[0.06em] text-neutral-500">Histórico</h2>
            <RoutineHistory items={r.history} bots={bots} onChat={onChat} onRun={r.run} />
          </>}
      {modal && <NewRoutine bots={bots} now={r.now} editing={modal.editing} onClose={r.close} onSubmit={r.save} />}
    </>
  );
}
