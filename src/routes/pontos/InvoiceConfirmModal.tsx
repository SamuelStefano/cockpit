import { useMemo, useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Modal, Button, Input, Badge, toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { invoiceDraftsFromSelection } from './invoiceFromSelection';
import { runInvoiceBatch, invoiceKey, summarize, type InvoiceResult } from './invoice-run';
import { brl, fmtPts, refMonth } from './money';
import { currentMonthKey } from './month-cap';

// Confirmação de geração de fatura(s) a partir da seleção. Cada delivery vira UMA
// fatura no DFL prod (status 'submitted' → revisão do admin → cobrança). Só tasks
// EM ABERTO entram. Mostra exatamente o que será criado antes de escrever — a
// escrita real só acontece no clique de confirmar (ação do usuário).
export function InvoiceConfirmModal({ projects, onClose, stale = false }: { projects: DflProjectNode[]; onClose: () => void; stale?: boolean }) {
  const { selected, clearSelected, deselect, write } = usePontosControls();
  const [month, setMonth] = useState(() => currentMonthKey(Date.now()));
  const [busy, setBusy] = useState(false);
  // Faturas já confirmadas pelo servidor NESTE modal. É o que impede o segundo
  // clique de recriar em prod o que a primeira passada já escreveu.
  const [created, setCreated] = useState<ReadonlySet<string>>(() => new Set());
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const monthValid = /^\d{4}-\d{2}$/.test(month);
  const drafts = useMemo(() => invoiceDraftsFromSelection(projects, selected, month), [projects, selected, month]);
  // Só o que ainda não foi escrito conta no total e no rótulo do botão: depois de
  // uma falha parcial o modal segue aberto e o "Criar 3 faturas" mentia.
  const pending = useMemo(() => drafts.filter((d) => !created.has(invoiceKey(d))), [drafts, created]);
  const totalPoints = pending.reduce((s, d) => s + d.points, 0);
  const totalCents = pending.reduce((s, d) => s + d.amountCents, 0);
  const resultOf = useMemo(() => new Map(results.map((r) => [r.key, r])), [results]);

  const confirm = async () => {
    if (busy || !pending.length || !monthValid || stale) return;
    setBusy(true);
    const batch = await runInvoiceBatch(drafts, created, (d) => write.onDflInvoice({
      deliveryId: d.deliveryId, deliveryName: d.deliveryName, projectId: d.projectId, projectName: d.projectName,
      referenceMonth: d.referenceMonth, pricePerPoint: d.pricePerPoint, tasks: d.tasks,
    }));
    setCreated(new Set([...created, ...batch.settled]));
    setResults(batch.results);
    setBusy(false);
    // Tira da seleção só o que já existe no DFL: as deliveries que falharam ficam
    // selecionadas pro retry, e o retry não reescreve as que deram certo.
    const done = batch.results.filter((r) => r.outcome !== 'failed').map((r) => r.deliveryId);
    if (done.length) deselect(done);
    const { created: okCount, failed } = summarize(batch.results);
    if (okCount > 0) toast(`${okCount} fatura${okCount > 1 ? 's' : ''} criada${okCount > 1 ? 's' : ''} (enviada${okCount > 1 ? 's' : ''} pra revisão)`);
    if (failed === 0) { clearSelected(); onClose(); }
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
          <Button onClick={confirm} loading={busy} disabled={!pending.length || !monthValid || stale}>
            {results.length ? 'Tentar de novo' : `Criar ${pending.length || ''} fatura${pending.length > 1 ? 's' : ''}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {stale && (
          // Open/paid status comes from the last DFL sync: invoicing from an old one
          // can bill tasks that were already invoiced since.
          <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            Os dados do DFL estão velhos. Sincronize antes de gerar a fatura: o que aparece como em aberto pode já estar faturado.
          </p>
        )}
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
            {drafts.map((d) => {
              const r = resultOf.get(invoiceKey(d));
              const done = !!r && r.outcome !== 'failed';
              return (
                <div key={d.deliveryId} className={`rounded-lg border bg-neutral-900/40 px-3 py-2.5 ${r?.outcome === 'failed' ? 'border-red-500/40' : done ? 'border-emerald-500/30' : 'border-neutral-800'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[12.5px] font-medium ${done ? 'text-neutral-500' : 'text-neutral-200'}`}>{d.deliveryName}</span>
                    {r ? <Badge tone={r.outcome === 'failed' ? 'red' : 'green'}>{r.outcome === 'created' ? 'criada' : r.outcome === 'skipped' ? 'já criada' : 'falhou'}</Badge>
                      : <Badge tone="neutral">{d.tasks.length} task{d.tasks.length > 1 ? 's' : ''}</Badge>}
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums text-orange-300">{fmtPts(d.points)} pt</span>
                    <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-400">{brl(d.amountCents)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-neutral-600">{d.projectName} · R$ {d.pricePerPoint}/pt</div>
                  {r?.outcome === 'failed' && <div className="mt-1 truncate text-[10.5px] text-red-300">{r.message}</div>}
                </div>
              );
            })}
            <div className="flex items-center gap-2 px-1 pt-1">
              <span className="min-w-0 flex-1 text-[12px] font-semibold text-neutral-200">Total</span>
              <span className="text-[12.5px] font-semibold tabular-nums text-orange-300">{fmtPts(totalPoints)} pt</span>
              <span className="w-24 text-right text-[12px] tabular-nums text-neutral-300">{brl(totalCents)}</span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-neutral-600">
          Cada fatura nasce como <span className="text-neutral-400">submitted</span> e vai pra revisão no DFL antes de virar cobrança. Uma fatura por delivery — uma delivery já faturada aqui não é reescrita se você tentar de novo.
        </p>
      </div>
    </Modal>
  );
}
