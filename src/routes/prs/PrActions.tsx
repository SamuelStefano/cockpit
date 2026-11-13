import { mergeBlocker, type PrDetail, type PrSummary } from '../../../shared/prs';
import { Badge } from '../../components/primitives/Badge';
import { Button } from '../../components/primitives/Button';
import { MergeModal } from './MergeModal';
import { usePrActions, type PrActionDeps } from './usePrActions';
import { useMergeFlow } from './useMergeFlow';

// `sendTo`: the chat that gets the fix-CI prompt, even where its own link is hidden.
interface PrActionsProps extends PrActionDeps { pr: PrSummary; detail: PrDetail | null; canMerge: boolean; sendTo?: string }

export function PrActions({ pr, detail, canMerge, sendTo, ...deps }: PrActionsProps) {
  const actions = usePrActions(sendTo ? { ...pr, sessionId: sendTo } : pr, detail, deps);
  const flow = useMergeFlow(pr);
  const blocker = mergeBlocker(pr);
  const open = pr.state === 'open';
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {open && canMerge && (
          <Button size="sm" icon="check" onClick={flow.start} disabled={!!blocker} title={blocker ?? undefined}>Mergear</Button>
        )}
        {open && canMerge && pr.checks === 'failure' && (
          <Button size="sm" variant="secondary" icon="wrench" onClick={actions.fixCi}>Consertar CI</Button>
        )}
        {open && (
          <Button size="sm" variant={canMerge ? 'ghost' : 'secondary'} icon="sparkles" onClick={actions.review}>Revisar com IA</Button>
        )}
        {pr.sessionId && <Button size="sm" variant="ghost" icon="message" onClick={actions.openSession}>Abrir conversa</Button>}
        {pr.state === 'merged' && <Badge tone="purple">Mergeada</Badge>}
        {pr.state === 'closed' && <Badge tone="red">Fechada</Badge>}
      </div>
      {open && canMerge && blocker && <p className="text-[12px] text-red-400">{blocker}</p>}
      {canMerge && <MergeModal pr={pr} flow={flow} />}
    </div>
  );
}
