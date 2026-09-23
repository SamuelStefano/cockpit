import { useEffect, useState } from 'react';
import { Modal, Button, Input, Badge, toast } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { fmtPts } from './money';
import { taskPointsEdit } from './task-points-edit';

const statusMeta = {
  paid: { tone: 'green' as const, label: 'pago (faturado)' },
  open: { tone: 'orange' as const, label: 'em aberto' },
  todo: { tone: 'neutral' as const, label: 'a fazer' },
};

// Detalhe + edição de uma task. A mudança de pontos vai pelo workflow SANCIONADO do
// DFL (dfl.work.task_points_change_request) — não UPDATE cru. Task paga já tem fatura:
// mudar os pontos agora NÃO reajusta a fatura, então avisamos antes.
export function TaskEditModal() {
  const { selectedTask, setSelectedTask, write } = usePontosControls();
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedTask) { setPoints(String(selectedTask.points)); setReason(''); }
  }, [selectedTask]);

  if (!selectedTask) return null;
  const t = selectedTask;
  const m = statusMeta[t.status];
  const { next, valid, changed, willTruncate } = taskPointsEdit(points, t.points);
  const close = () => setSelectedTask(null);

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    const r = await write.onDflChange({ taskId: t.id, taskName: t.name, currentPoints: t.points, newPoints: next, reason });
    setSaving(false);
    if (r.ok) { toast(`Pontos de "${t.name || 'task'}" atualizados pra ${next}`); close(); }
    else toast(r.message || 'Falha ao mudar pontos', { tone: 'error' });
  };

  return (
    <Modal
      open
      onClose={close}
      title={t.name || 'Sem título'}
      icon="pencil"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>Cancelar</Button>
          <Button onClick={save} loading={saving} disabled={!changed}>Salvar pontos</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge tone={m.tone} dot>{m.label}</Badge>
          <span className="text-[12px] tabular-nums text-neutral-500">atual: {fmtPts(t.points)} pt</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-400">Pontos</span>
          <Input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="numeric" error={!valid} />
          {willTruncate && <span className="text-[11px] text-neutral-500">O DFL grava pontos inteiros — vai salvar {next}.</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-neutral-400">Motivo <span className="text-neutral-600">(opcional)</span></span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex: alinhar com o invoice_item" />
        </label>
        {t.status === 'paid' && (
          <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[11.5px] text-yellow-200">
            Task já faturada — mudar os pontos aqui não reajusta a fatura existente.
          </p>
        )}
        <p className="text-[11px] text-neutral-600">
          A mudança dispara o workflow oficial do DFL (aprovação automática como admin) e re-sincroniza.
        </p>
      </div>
    </Modal>
  );
}
