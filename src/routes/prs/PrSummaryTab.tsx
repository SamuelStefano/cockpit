import type { PrSummary } from '../../../shared/prs';
import { Markdown } from '../../components/primitives/Markdown';

export function PrSummaryTab({ pr, body }: { pr: PrSummary; body?: string }) {
  return (
    <div className="space-y-5">
      {pr.riskReasons.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">Por que esse risco</h3>
          <ul className="space-y-1 text-[13px] text-neutral-300">
            {pr.riskReasons.map((r) => <li key={r}>• {r}</li>)}
          </ul>
        </section>
      )}
      {body === undefined ? <p className="text-[13px] text-neutral-500">Carregando descrição…</p>
        : body.trim() ? <Markdown md={body} /> : <p className="text-[13px] text-neutral-500">Sem descrição.</p>}
    </div>
  );
}
