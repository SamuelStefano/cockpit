import { useState } from 'react';
import type { AreaBudget, AreaId } from '../../../shared/canvas';
import { AREA_LABELS } from '../../../shared/canvas';
import { Button, Input, Modal, Switch } from '../../components/primitives';

interface Props {
  area: AreaId;
  budget: AreaBudget | undefined;
  onSave: (area: AreaId, budget: AreaBudget) => void;
  onClose: () => void;
}

// No popover primitive exists in this design system yet (checked: Input,
// Button, Switch, Modal are it), and the chip that opens this sits inside the
// canvas' pan/zoom transform — anchoring a floating panel there would have to
// fight the scale on every zoom level. Modal sidesteps both problems and
// reuses the one overlay primitive the rest of the app already has.
export function AreaBudgetEditor({ area, budget, onSave, onClose }: Props) {
  const [ctxTokens, setCtxTokens] = useState(budget?.ctxTokens ? String(budget.ctxTokens) : '');
  const [cpu, setCpu] = useState(budget?.cpu ? String(budget.cpu) : '');
  const [autoPause, setAutoPause] = useState(!!budget?.autoPause);

  const save = () => {
    const next: AreaBudget = {};
    const ct = Number(ctxTokens);
    const cp = Number(cpu);
    if (ctxTokens.trim() && Number.isFinite(ct) && ct > 0) next.ctxTokens = ct;
    if (cpu.trim() && Number.isFinite(cp) && cp > 0) next.cpu = cp;
    if (autoPause) next.autoPause = true;
    onSave(area, next);
  };

  return (
    <Modal open onClose={onClose} title={`Orçamento — ${AREA_LABELS[area]}`} icon="layers" maxWidth="max-w-sm"
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>cancelar</Button><Button size="sm" onClick={save}>salvar</Button></>}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-400">teto de contexto (tokens somados das sessões rodando)</span>
          <Input size="sm" mono inputMode="numeric" placeholder="sem teto" value={ctxTokens} onChange={(e) => setCtxTokens(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-400">teto de cpu % (somado dos terminais abertos)</span>
          <Input size="sm" mono inputMode="numeric" placeholder="sem teto" value={cpu} onChange={(e) => setCpu(e.target.value.replace(/[^0-9]/g, ''))} />
        </label>
        <Switch
          checked={autoPause} onChange={() => setAutoPause((v) => !v)} icon="pause"
          label="parar sozinho quando estourar" hint="para o turno mais pesado da área após 30s contínuos acima do teto"
        />
      </div>
    </Modal>
  );
}
