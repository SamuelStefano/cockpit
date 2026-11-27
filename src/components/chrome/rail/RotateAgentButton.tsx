import { useState } from 'react';
import { Button, Popover } from '../../primitives';

export function RotateAgentButton({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const content = (
    <div className="w-60 space-y-2.5 p-3">
      <p className="text-[13px] leading-snug text-(--text-body)">Começar do zero? A conversa atual fica no histórico.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="xs" onClick={() => { setOpen(false); onConfirm(); }}>Começar</Button>
      </div>
    </div>
  );
  return (
    <Popover open={open} onClose={() => setOpen(false)} content={content} side="bottom" align="start" label="Nova conversa do agente">
      <Button size="sm" disabled={busy} title={busy ? 'Espere o agente terminar' : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Nova conversa</Button>
    </Popover>
  );
}
