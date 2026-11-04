import { Menu, MenuItem, MenuSeparator } from '../../primitives';
import type { RailMenu } from './useBoxRail';

interface Props {
  menu: RailMenu;
  onClose: () => void;
  onRename: () => void;
  onRevoke: () => void;
  onHealth: () => void;
}

export function BoxRailMenu({ menu, onClose, onRename, onRevoke, onHealth }: Props) {
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div style={{ left: menu.x, top: menu.y }} className="fixed z-50 rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl shadow-black/40">
        <Menu label="Opções da máquina">
          <MenuItem icon="pencil" label="Renomear" onClick={onRename} />
          <MenuItem icon="shield" label="Saúde da máquina" onClick={onHealth} />
          <MenuSeparator />
          <MenuItem icon="trash" label="Remover" danger onClick={onRevoke} />
        </Menu>
      </div>
    </>
  );
}
