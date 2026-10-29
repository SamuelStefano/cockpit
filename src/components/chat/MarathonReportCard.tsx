import { Button, Icon } from '../primitives';
import { fmtDuration, type MarathonRun } from '../../lib/gamify/marathon-report';

interface MarathonReportCardProps {
  run: MarathonRun;
  prs: number;
  onDismiss: () => void;
}

// Static first slice of the marathon report: how long, how many turns, how many PRs.
export function MarathonReportCard({ run, prs, onDismiss }: MarathonReportCardProps) {
  const parts = [fmtDuration(run.lastActive - run.start), `${run.turns} ${run.turns === 1 ? 'turno' : 'turnos'}`, `${prs} ${prs === 1 ? 'PR' : 'PRs'}`];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2">
      <div role="status" className="flex items-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/[0.07] py-1.5 pl-3 pr-1.5 text-[13px] text-green-200">
        <Icon name="check" size={14} className="shrink-0" />
        <span className="min-w-0 flex-1"><span className="font-medium">Maratona concluída</span> · {parts.join(' · ')}</span>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Fechar</Button>
      </div>
    </div>
  );
}
