import { Button, Modal } from '../../components/primitives';

interface DeleteAgentModalProps {
  name: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAgentModal({ name, onCancel, onConfirm }: DeleteAgentModalProps) {
  return (
    <Modal
      open={name !== null} onClose={onCancel} title="Excluir agente" maxWidth="max-w-sm"
      footer={<><Button variant="ghost" size="md" onClick={onCancel}>Cancelar</Button><Button variant="danger" size="md" onClick={onConfirm}>Excluir</Button></>}
    >
      <p className="text-[14px] text-(--text-strong)">Excluir <strong>{name}</strong>? Isso não dá para desfazer.</p>
    </Modal>
  );
}
