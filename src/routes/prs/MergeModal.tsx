import type { PrSummary } from '../../../shared/prs';
import { Button } from '../../components/primitives/Button';
import { Input } from '../../components/primitives/Input';
import { Modal } from '../../components/primitives/Modal';
import type { useMergeFlow } from './useMergeFlow';

type Flow = ReturnType<typeof useMergeFlow>;

export function MergeModal({ pr, flow }: { pr: PrSummary; flow: Flow }) {
  const warnings: string[] = [];
  if (pr.risk !== 'safe') warnings.push(`Risco ${pr.risk === 'unsafe' ? 'inseguro' : 'talvez inseguro'}${pr.riskReasons.length ? `: ${pr.riskReasons.join(', ')}` : ''}`);
  if (pr.checks === 'failure') warnings.push('O CI falhou');
  if (pr.isDraft) warnings.push('A PR é um rascunho');
  return (
    <Modal
      open={flow.open} onClose={flow.cancel} title={`Mergear ${flow.expected}`} icon="gitPullRequest"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={flow.cancel} disabled={flow.busy}>Cancelar</Button>
          <Button variant="dangerSolid" size="sm" onClick={flow.confirm} disabled={!flow.canConfirm} loading={flow.busy}>Mergear</Button>
        </>
      }
    >
      <p className="text-[13px] text-neutral-300">{pr.title}</p>
      {flow.needsConfirm ? (
        <div className="mt-3 space-y-3">
          <ul className="space-y-1 text-[13px] text-red-400">
            {warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
          <p className="text-[13px] text-neutral-400">Pra confirmar, digite <span className="font-mono text-neutral-100">{flow.expected}</span>.</p>
          <Input
            mono autoFocus value={flow.typed} onChange={(e) => flow.setTyped(e.target.value)} placeholder={flow.expected}
            onKeyDown={(e) => { if (e.key === 'Enter') flow.confirm(); }} aria-label="Confirmação do merge"
          />
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-neutral-400">Esta PR será mergeada na base. Confirmar?</p>
      )}
    </Modal>
  );
}
