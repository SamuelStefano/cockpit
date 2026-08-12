import { useMemo, useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Modal, Button, Input, Badge, toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { invoiceDraftsFromSelection } from './invoiceFromSelection';
import { brl, fmtPts, refMonth } from './money';

const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// Confirmação de geração de fatura(s) a partir da seleção. Cada delivery vira UMA
// fatura no DFL prod (status 'submitted' → revisão do admin → cobrança). Só tasks
// EM ABERTO entram. Mostra exatamente o que será criado antes de escrever — a
// escrita real só acontece no clique de confirmar (ação do usuário).
export function InvoiceConfirmModal({ projects, onClose }: { projects: DflProjectNode[]; onClose: () => void }) {
  const { selected, clearSelected, write } = usePontosControls();
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const monthValid = /^\d{4}-\d{2}$/.test(month);
  const drafts = useMemo(() => invoiceDraftsFromSelection(projects, selected, month), [projects, selected, month]);
  const totalPoints = drafts.reduce((s, d) => s + d.points, 0);
  const totalCents = drafts.reduce((s, d) => s + d.amountCents, 0);

  const confirm = async () => {
    if (busy || !drafts.length || !monthValid) return;
    setBusy(true);
    let ok = 0; const fails: string[] = [];
    for (const d of drafts) {
      const r = await write.onDflInvoice({
        deliveryId: d.deliveryId, deliveryName: d.deliveryName, projectId: d.projectId, projectName: d.projectName,
        referenceMonth: d.referenceMonth, pricePerPoint: d.pricePerPoint, tasks: d.tasks,
      });
      if (r.ok) ok += 1; else fails.push(`${d.deliveryName}: ${r.message ?? 'erro'}`);
    }
    setBusy(false);
    if (ok > 0) toast(`${ok} fatura${ok > 1 ? 's' : ''} criada${ok > 1 ? 's' : ''} (enviada${ok > 1 ? 's' : ''} pra revisão)`);
    if (fails.length) toast(fails.join(' · '), { tone: 'error', durationMs: 8000 });
    if (fails.length === 0) { clearSelected(); onClose(); }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Gerar fatura no DFL"
      icon="file"
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={confirm} loading={busy} disabled={!drafts.length || !monthValid}>
            Criar {drafts.length || ''} fatura{drafts.length > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-3">
          <span className="text-[12px] text-neutral-400">Mês de referência</span>
          <Input value={month} onChange={(e) => setMonth(e.target.value)} error={!monthValid} mono size="sm" className="w-28" placeholder="2026-07" />
          {monthValid && <span className="text-[11.5px] text-neutral-500">{refMonth(month)}</span>}
        </label>

        {drafts.length === 0 ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-3 text-[12px] text-neutral-500">
            Nenhuma delivery selecionada tem task em aberto pra faturar. Só tasks concluídas e ainda não faturadas entram numa fatura.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {drafts.map((d) => (
              <div key={d.deliveryId} className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-neutral-200">{d.deliveryName}</span>
                  <Badge tone="neutral">{d.tasks.length} task{d.tasks.length > 1 ? 's' : ''}</Badge>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-orange-300">{fmtPts(d.points)} pts</span>
                  <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-400">{brl(d.amountCents)}</span>
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-neutral-600">{d.projectName} · R$ {d.pricePerPoint}/pt</div>
              </div>
            ))}
            <div className="flex items-center gap-2 px-1 pt-1">
              <span className="min-w-0 flex-1 text-[12px] font-semibold text-neutral-200">Total</span>
              <span className="text-[12.5px] font-semibold tabular-nums text-orange-300">{fmtPts(totalPoints)} pts</span>
              <span className="w-24 text-right text-[12px] tabular-nums text-neutral-300">{brl(totalCents)}</span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-neutral-600">
          Cada fatura nasce como <span className="text-neutral-400">submitted</span> e vai pra revisão no DFL antes de virar cobrança. Uma fatura por delivery.
        </p>
      </div>
    </Modal>
  );
}
