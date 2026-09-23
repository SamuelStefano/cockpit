import { useState } from 'react';
import { DEFAULT_FLOW_TEMPLATE, type CanvasFlow, type CanvasNode } from '../../../shared/canvas';
import { relPast } from '../../../shared/format';
import { Button, Modal, Switch } from '../../components/primitives';

interface Props {
  flow: CanvasFlow;
  isNew: boolean;
  node: (id: string) => CanvasNode | undefined;
  onSave: (flow: CanvasFlow) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Fluxo do canvas: quando o nó `from` termina um turno, o resultado vira o
// prompt do `to`. Mesmo padrão do CardEditor (estado local, salva no fecho).
export function FlowEditor({ flow: initial, isNew, node, onSave, onDelete, onClose }: Props) {
  const [flow, setFlow] = useState(initial);
  const patch = (p: Partial<CanvasFlow>) => setFlow((f) => ({ ...f, ...p }));
  const from = node(flow.from);
  const to = node(flow.to);

  return (
    <Modal
      open onClose={onClose} icon="zap" maxWidth="max-w-lg"
      title={isNew ? 'Novo fluxo' : 'Editar fluxo'}
      footer={(
        <div className="flex w-full items-center gap-2">
          {!isNew && <Button variant="danger" size="sm" icon="trash" onClick={() => onDelete(flow.id)}>excluir</Button>}
          <span className="flex-1" />
          <Button size="sm" onClick={() => onSave(flow)}>salvar</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12px]">
          <span className="min-w-0 flex-1 truncate text-neutral-200">{from?.title ?? flow.from}</span>
          <span className="shrink-0 text-orange-400">→</span>
          <span className="min-w-0 flex-1 truncate text-right text-neutral-200">{to?.title ?? flow.to}</span>
        </div>
        <div>
          <textarea
            value={flow.template} onChange={(e) => patch({ template: e.target.value })} rows={5}
            placeholder={DEFAULT_FLOW_TEMPLATE}
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[12.5px] text-neutral-100 placeholder:text-neutral-600 focus:border-orange-500/50 focus:outline-hidden"
          />
          <p className="mt-1 text-[10.5px] text-neutral-500">
            Use <code className="rounded bg-neutral-800 px-1 py-0.5">{'{{result}}'}</code> onde o resultado da etapa anterior deve entrar.
            Sem o placeholder, o resultado entra logo depois do texto. Vazio usa o padrão.
          </p>
        </div>
        <Switch checked={flow.enabled} onChange={() => patch({ enabled: !flow.enabled })} label="Fluxo ativo" hint="desligado não dispara, mas fica desenhado" icon="zap" />
        {!isNew && (
          <p className="text-[10.5px] text-neutral-500">
            {flow.fires === 0 ? 'nunca disparou' : `disparou ${flow.fires}x${flow.lastFiredAt ? ` · última vez ${relPast(flow.lastFiredAt)}` : ''}`}
          </p>
        )}
      </div>
    </Modal>
  );
}
