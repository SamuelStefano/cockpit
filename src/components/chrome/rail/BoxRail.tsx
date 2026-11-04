import { useEscapeLayer } from '../../primitives/useEscapeLayer';
import { Button, IconButton, Input, Modal } from '../../primitives';
import { AddBoxModal } from '../../sessions/AddBoxModal';
import { NO_UNREAD } from '../../../cockpit/box-unread';
import { BoxRailMenu } from './BoxRailMenu';
import { BoxRailTile } from './BoxRailTile';
import { useBoxRail } from './useBoxRail';

const MENU_GAP = 4;
const MENU_HEIGHT = 170;

export function BoxRail({ activeSessionId, userId }: { activeSessionId: string; userId?: string }) {
  const r = useBoxRail(activeSessionId);
  useEscapeLayer(!!r.menu, r.closeMenu);
  if (!r.visible) return null;
  const confirming = r.sorted.find((b) => b.id === r.confirmId);

  return (
    <nav aria-label="Máquinas" className="relative z-40 flex h-full w-16 shrink-0 flex-col items-center gap-2 border-r border-neutral-800 bg-neutral-950 py-3">
      <div className="scroll-thin flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto">
        {r.sorted.map((b) => (
          <BoxRailTile
            key={b.id} box={b} active={b.id === r.active} level={r.levelOf(b.id)} unread={r.unread[b.id] ?? NO_UNREAD} onOpen={r.open}
            onMenu={(e, boxId) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              r.openMenu({ boxId, x: rect.right + MENU_GAP, y: Math.max(MENU_GAP, Math.min(rect.top, window.innerHeight - MENU_HEIGHT)) });
            }}
          />
        ))}
      </div>
      <IconButton icon="plus" label="Adicionar máquina" side="right" onClick={r.startAdd} />

      {r.menu && (
        <BoxRailMenu
          menu={r.menu} onClose={r.closeMenu}
          onRename={() => { const b = r.sorted.find((x) => x.id === r.menu?.boxId); r.closeMenu(); if (b) r.startEdit(b); }}
          onRevoke={() => { const id = r.menu?.boxId; r.closeMenu(); if (id) r.askRevoke(id); }}
          onHealth={() => { r.closeMenu(); r.openHealth(); }}
        />
      )}
      <Modal open={!!r.editingId} onClose={r.cancelEdit} title="Renomear máquina" icon="pencil">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); r.commitEdit(); }}>
          <Input autoFocus value={r.draft} maxLength={64} aria-label="Novo nome da máquina" onChange={(e) => r.setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={r.cancelEdit}>Cancelar</Button>
            <Button size="sm" type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!confirming} onClose={r.cancelRevoke} title="Remover máquina" icon="trash">
        <p className="mb-3 text-[13px] leading-snug text-neutral-400">
          {confirming?.id === r.active
            ? 'Você está nesta máquina: remover desconecta o Deck dela.'
            : 'A máquina deixa de aparecer no Deck e precisa ser pareada de novo.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={r.cancelRevoke}>Cancelar</Button>
          <Button variant="dangerSolid" size="sm" onClick={() => { if (r.confirmId) r.revoke(r.confirmId); }}>Remover</Button>
        </div>
      </Modal>
      {r.adding && <AddBoxModal onClose={r.stopAdd} userId={userId} />}
    </nav>
  );
}
