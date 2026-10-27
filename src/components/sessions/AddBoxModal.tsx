import { Modal } from '../primitives';
import { BoxPairing } from './BoxPairing';

export function AddBoxModal({ onClose, userId }: { onClose: () => void; userId?: string }) {
  return (
    <Modal open onClose={onClose} title="Adicionar máquina" icon="plus" maxWidth="max-w-xl">
      <BoxPairing userId={userId} />
    </Modal>
  );
}
