import { Button, Modal } from '../primitives';
import { useQrApprove } from './useQrApprove';

export function QrApproveModal({ signedIn }: { signedIn: boolean }) {
  const a = useQrApprove(signedIn);
  return (
    <Modal open={a.open} onClose={a.refuse} title="Entrar em outro aparelho?" icon="smartphone" maxWidth="max-w-sm">
      <p className="text-[13px] leading-relaxed text-neutral-400">
        Um <span className="text-neutral-200">{a.device}</span> pediu para entrar no Deck com a sua conta.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-amber-200/90">
        Só aprove se o código está numa tela sua, na sua frente. Quem aprovar ganha acesso total à conta.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={a.refuse} disabled={a.busy}>Recusar</Button>
        <Button variant="primary" size="sm" onClick={a.approve} loading={a.busy}>Aprovar</Button>
      </div>
    </Modal>
  );
}
