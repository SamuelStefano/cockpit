import { useState } from 'react';
import { Button, Modal } from '../primitives';
import { DropForm } from './DropForm';
import { DropList } from './DropList';
import type { DropApi } from '../../cockpit/useDrops';

// Entrada do drop privado no menu de perfil. Caminho dedicado pra entregar
// segredo/script ao agente sem colar no chat (que grava no JSONL e reenvia a cada
// turno) nem anexar (que espelha no S3 e injeta o texto no prompt).
export function DropButton({ api }: { api: DropApi }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <Button variant="outline" size="sm" icon="shield" className="w-full" onClick={() => setOpen(true)}>
        Drop privado
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Drop privado" icon="shield" maxWidth="max-w-md">
        <p className="text-[12px] leading-relaxed text-neutral-400">
          Grava o arquivo direto na box do agente. O conteúdo não entra no chat, não vira anexo e não sobe pro S3 —
          a resposta é só o caminho. Vale texto (env, chave, script), até 1 MB.
          Peça ao agente pra <span className="text-neutral-200">consumir sem imprimir</span>:
          se ele der Read, o segredo volta pro transcript.
        </p>
        <DropForm api={api} open={open} />
        <div className="mt-5 border-t border-neutral-800 pt-3">
          <h3 className="text-[11px] font-medium text-neutral-500">Na box</h3>
          <DropList items={api.drops} onRemove={api.onDropRm} />
        </div>
      </Modal>
    </div>
  );
}
