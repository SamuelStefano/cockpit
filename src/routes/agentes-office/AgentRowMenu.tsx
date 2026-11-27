import { useState } from 'react';
import { Button, Menu, MenuItem, Popover } from '../../components/primitives';

interface AgentRowMenuProps {
  name: string;
  busy: boolean;
  canDelete: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function AgentRowMenu({ name, busy, canDelete, onDuplicate, onDelete }: AgentRowMenuProps) {
  const [open, setOpen] = useState(false);
  const pick = (action: () => void) => () => { setOpen(false); action(); };
  return (
    <Popover
      open={open} onClose={() => setOpen(false)} label={`Ações de ${name}`} side="bottom" align="end"
      content={
        <Menu label={`Ações de ${name}`}>
          <MenuItem icon="copy" label="Duplicar" disabled={busy} onClick={pick(onDuplicate)} />
          <MenuItem icon="trash" danger label="Excluir" disabled={!canDelete} onClick={pick(onDelete)} />
        </Menu>
      }
    >
      <Button variant="ghost" size="sm" square icon="ellipsis" aria-label={`Mais ações de ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
    </Popover>
  );
}
