import { useState } from 'react';
import { Badge, Button, Input, ProgressBar } from '../../components/primitives';
import { capDetail, type MonthCap, type MonthCapState } from './month-cap';
import { usePontosControls } from './pontosControls';
import { brl, refMonth } from './money';

const BADGE: Record<MonthCapState, { tone: 'green' | 'yellow' | 'red'; text: string }> = {
  ok: { tone: 'green', text: 'dentro do teto' },
  full: { tone: 'yellow', text: 'teto batido' },
  over: { tone: 'red', text: 'estourado' },
};

// Teto do MÊS: limita a fatura, não o trabalho. A barra mostra o que já foi
// faturado, o que ainda cabe faturar e o que fica em espera pro mês seguinte —
// espera é estado normal aqui, não alarme. Quem define o teto do mês é o Tainan,
// então o valor é editável e fica gravado por mês.
export function MonthCapBar({ cap }: { cap: MonthCap }) {
  const { setMonthCapCents } = usePontosControls();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const badge = BADGE[cap.state];

  const open = () => { setDraft(String(Math.round(cap.capCents / 100))); setEditing(true); };
  const confirm = () => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) setMonthCapCents(cap.month, Math.round(n * 100));
    setEditing(false);
  };

  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3.5 py-3 hairline">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-500">Teto de {refMonth(cap.month)}</span>
        <Badge tone={badge.tone} dot>{badge.text}</Badge>
        {editing ? (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11.5px] text-neutral-500">R$</span>
            <Input
              size="sm" type="number" inputMode="decimal" step="100" min="0" value={draft} autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setEditing(false); }}
              className="w-24 tabular-nums"
            />
            <Button variant="primary" size="sm" onClick={confirm}>ok</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>cancelar</Button>
          </div>
        ) : (
          <>
            <span className="ml-auto text-[13px] font-medium tabular-nums text-neutral-200">
              {brl(cap.billedCents)} <span className="text-neutral-500">faturado de {brl(cap.capCents)}</span>
            </span>
            <Button variant="ghost" size="sm" icon="pencil" onClick={open}>teto do mês</Button>
          </>
        )}
      </div>
      <ProgressBar className="mt-2.5" segments={[
        { value: cap.billedCents, tone: 'green', label: `faturado no mês: ${brl(cap.billedCents)}` },
        { value: cap.invoiceableCents, tone: 'orange', label: `dá pra faturar agora: ${brl(cap.invoiceableCents)}` },
        { value: Math.max(0, cap.headroomCents - cap.invoiceableCents), tone: 'track', label: `teto livre: ${brl(Math.max(0, cap.headroomCents - cap.invoiceableCents))}` },
      ]} />
      <p className="mt-2 text-[11px] tabular-nums text-neutral-500">{capDetail(cap, brl)}</p>
      {cap.waitingCents > 0 && (
        <p className="mt-1 text-[11px] tabular-nums text-yellow-300/80">
          Em espera: {brl(cap.waitingCents)} — registrado, não perdido.
        </p>
      )}
    </div>
  );
}
