import { Button, Icon, tokens } from '../primitives';
import type { ToolCall } from '../../data/types';
import { useWorkflowReview } from './useWorkflowReview';

interface WorkflowReviewCardProps {
  tool: ToolCall;
  reviewable: boolean;
  onApprove?: (text: string) => boolean | void;
}

export function WorkflowReviewCard({ tool, reviewable, onApprove }: WorkflowReviewCardProps) {
  const { decision, showScript, locked, approve, deny, toggleScript } = useWorkflowReview(tool, reviewable, onApprove);
  const w = tool.workflow;

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/6">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-300">
          <Icon name="shield" size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-amber-100">Revisar workflow antes de rodar</div>
          {(w?.description || w?.name) && (
            <div className="truncate text-[12px] text-neutral-400">{w.description ?? w.name}</div>
          )}
        </div>
      </div>
      {w?.scriptPath && (
        <div className="px-3 pb-2">
          <code className="block truncate rounded-md border border-neutral-800 bg-[#0c0c0c] px-2.5 py-1.5 font-mono text-[11.5px] text-neutral-300">{w.scriptPath}</code>
        </div>
      )}
      {w?.script && (
        <div className="border-t border-amber-500/15">
          <button
            onClick={toggleScript}
            className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] text-neutral-500 transition hover:text-neutral-300 ${tokens.focusRing}`}
          >
            <Icon name="chevronDown" size={13} className="transition-transform duration-200" style={{ transform: showScript ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
            {showScript ? 'ocultar script' : 'mostrar script'}
          </button>
          {showScript && (
            <pre className="scroll-thin max-h-80 overflow-auto border-t border-neutral-800 bg-[#070707] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-neutral-300">{w.script}</pre>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-amber-500/15 px-3 py-2">
        {decision === 'approved' ? (
          <span className="flex items-center gap-1.5 text-[12px] text-green-400"><Icon name="check" size={13} /> aprovado · rodando de novo</span>
        ) : decision === 'denied' ? (
          <span className="flex items-center gap-1.5 text-[12px] text-neutral-500"><Icon name="x" size={13} /> negado · o workflow não roda (nada foi enviado ao Claude)</span>
        ) : (
          <>
            <Button variant="primary" size="sm" icon="check" onClick={approve} disabled={locked}>Aprovar e rodar</Button>
            <Button variant="ghost" size="sm" icon="x" onClick={deny} disabled={locked} title="Não roda o workflow. Nada é enviado ao Claude: o turno já terminou com ele bloqueado.">Negar</Button>
            {!reviewable && <span className="text-[11px] text-neutral-600">só na última resposta, com a sessão ociosa</span>}
          </>
        )}
      </div>
    </div>
  );
}
