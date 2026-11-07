import { Button, EmptyState, Input, Modal, SectionTitle } from '../../components/primitives';
import { AddBoxModal } from '../../components/sessions/AddBoxModal';
import { useBoxSwitcher } from '../../components/sessions/useBoxSwitcher';
import { NO_UNREAD, useBoxUnread } from '../../cockpit/box-unread';
import { openBox } from '../../cockpit/box-open';
import { MachineRow } from './MachineRow';

export function Maquinas({ userId }: { userId?: string }) {
  const s = useBoxSwitcher();
  const unread = useBoxUnread();
  const confirming = s.sorted.find((b) => b.id === s.confirmId);

  return (
    <>
      <div className="flex items-center max-lg:hidden">
        <SectionTitle className="flex-1">Máquinas</SectionTitle>
        <Button variant="secondary" size="sm" icon="plus" onClick={s.startAdd}>Adicionar máquina</Button>
      </div>
      {!s.visible ? (
        <EmptyState size="sm" icon="monitor" title="Nenhuma máquina ainda" description="Adicione uma máquina para conversar com o agente dela.">
          <Button icon="plus" onClick={s.startAdd}>Adicionar máquina</Button>
        </EmptyState>
      ) : (
        <ul aria-label="Máquinas" className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 hairline max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent">
          {s.sorted.map((b) => (
            <MachineRow
              key={b.id} box={b} active={b.id === s.active} level={s.levelOf(b.id)} unread={unread[b.id] ?? NO_UNREAD}
              onOpen={() => openBox(b.id, s.active, s.select)} onRename={() => s.startEdit(b)} onRevoke={() => s.askRevoke(b.id)}
            />
          ))}
        </ul>
      )}
      {s.visible && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="lg:hidden" variant="secondary" icon="plus" onClick={s.startAdd}>Adicionar máquina</Button>
          <Button variant="ghost" size="sm" icon="shield" onClick={s.openHealth}>Saúde das máquinas</Button>
        </div>
      )}

      <Modal open={!!s.editingId} onClose={s.cancelEdit} title="Renomear máquina" icon="pencil">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); s.commitEdit(); }}>
          <Input autoFocus value={s.draft} maxLength={64} aria-label="Novo nome da máquina" onChange={(e) => s.setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={s.cancelEdit}>Cancelar</Button>
            <Button size="sm" type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!confirming} onClose={s.cancelRevoke} title="Remover máquina" icon="trash">
        <p className="mb-3 text-[13px] leading-snug text-neutral-400">
          {confirming?.id === s.active
            ? 'Você está nesta máquina: remover desconecta o Deck dela.'
            : 'A máquina deixa de aparecer no Deck e precisa ser pareada de novo.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={s.cancelRevoke}>Cancelar</Button>
          <Button variant="dangerSolid" size="sm" onClick={() => { if (s.confirmId) s.revoke(s.confirmId); }}>Remover</Button>
        </div>
      </Modal>
      {s.adding && <AddBoxModal onClose={s.stopAdd} userId={userId} />}
    </>
  );
}
