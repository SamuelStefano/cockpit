import { Button, Input, Modal } from '../primitives';
import { useQrApprove } from './useQrApprove';

export function QrApproveModal({ signedIn }: { signedIn: boolean }) {
  const a = useQrApprove(signedIn);
  return (
    <Modal open={a.open} onClose={a.dismiss} title="Entrar em outro aparelho?" icon="smartphone" maxWidth="max-w-sm">
      <p className="text-[13px] leading-relaxed text-neutral-400">
        Um <span className="text-neutral-200">{a.device}</span> pediu para entrar no Deck com a sua conta.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-amber-200/90">
        Só aprove se o QR está numa tela sua, na sua frente. Quem entrar tem acesso total à conta.
      </p>
      <label htmlFor="qr-approve-code" className="mb-1.5 mt-4 block text-[12px] font-medium text-neutral-400">
        Código de 4 números embaixo do QR
      </label>
      <Input
        id="qr-approve-code" value={a.code} onChange={(e) => a.setCode(e.target.value)}
        inputMode="numeric" autoComplete="one-time-code" placeholder="0000" className="font-mono tracking-[0.3em]"
      />
      {a.err && <p className="mt-2 text-[12.5px] text-red-300">{a.err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={a.refuse} disabled={a.busy}>Recusar</Button>
        <Button variant="primary" size="sm" onClick={a.approve} loading={a.busy} disabled={!a.canApprove}>Aprovar</Button>
      </div>
    </Modal>
  );
}
