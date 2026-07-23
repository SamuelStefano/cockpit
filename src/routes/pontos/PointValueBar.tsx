import { useState } from 'react';
import { Button, Icon, Input } from '../../components/primitives';
import { brl } from './money';
import { usePontosControls } from './pontosControls';

// Informativo do valor do ponto (R$/pt) que baseia o recebível. Editar exige
// confirmação porque recalcula todos os valores "em aberto" e "off" — valores já
// pagos/faturados não mudam (histórico real).
export function PointValueBar() {
  const { pointValue, setPointValue } = usePontosControls();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(pointValue));

  const open = () => { setDraft(String(pointValue)); setEditing(true); };
  const confirm = () => {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) setPointValue(Math.round(n * 100) / 100);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-neutral-800/80 bg-neutral-900/30 px-3 py-2">
        <Icon name="zap" size={13} className="shrink-0 text-orange-300" />
        <span className="text-[12px] text-neutral-400">Valor do ponto</span>
        <span className="text-[12.5px] font-semibold tabular-nums text-neutral-100">{brl(pointValue * 100)}</span>
        <span className="text-[11px] text-neutral-600">base do recebível</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={open}>
          <Icon name="pencil" size={13} /> alterar
        </Button>
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-lg border border-orange-500/30 bg-neutral-900/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-neutral-400">R$</span>
        <Input
          size="sm" type="number" inputMode="decimal" step="0.01" min="0" value={draft} autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setEditing(false); }}
          className="w-24 tabular-nums"
        />
        <span className="text-[11px] text-neutral-500">por ponto</span>
      </div>
      <p className="mt-2 text-[11px] text-orange-300/80">
        Tem certeza? Isso recalcula todo o recebível (em aberto e off). Valores já pagos/faturados não mudam.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={confirm}>confirmar</Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>cancelar</Button>
      </div>
    </div>
  );
}
