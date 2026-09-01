import { useEffect, useRef, useState } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { Button, tokens } from '../primitives';
import { prettyModel } from './toolbar-format';
import { modelOptions } from './model-options';

// Dispara um item da fila AGORA, num chat paralelo que herda o contexto deste. O
// turno em andamento não é interrompido — por isso o modelo é escolhido aqui e não
// herdado do chat: quase sempre o disparo avulso pede um modelo mais barato.
export function QueuedBgLauncher({ id, model, models, onRun, onCancel }: {
  id: string;
  model: string;
  models: ModelInfo[];
  onRun: (model: string) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState(model);
  const selRef = useRef<HTMLSelectElement>(null);
  useEffect(() => { selRef.current?.focus(); }, []);
  const list = modelOptions(models, model);
  return (
    <div
      id={id}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}
      className="mt-1 flex flex-wrap items-center gap-1.5 rounded-md border border-orange-500/25 bg-neutral-950/60 px-1.5 py-1"
    >
      <span className="text-[10px] text-neutral-400">rodar em paralelo com</span>
      <select
        ref={selRef}
        value={chosen}
        onChange={(e) => setChosen(e.target.value)}
        aria-label="Modelo do agente em background"
        className={`rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[11px] text-neutral-300 outline-none transition hover:border-neutral-700 focus:border-orange-500/40 sm:px-1.5 sm:py-0.5 sm:text-[10.5px] ${tokens.focusRing}`}
      >
        {list.map((o) => <option key={o.id} value={o.id}>{prettyModel(o.id, o.displayName)}</option>)}
      </select>
      <Button
        size="sm"
        icon="play"
        onClick={() => onRun(chosen)}
        title="Tira este item da fila e roda agora num chat paralelo com o contexto deste"
      >
        disparar
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} title="Fechar">
        cancelar
      </Button>
    </div>
  );
}
