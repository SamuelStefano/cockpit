import { Button, Input, Modal } from '../primitives';
import { useDeleteAccount } from './useDeleteAccount';

// Store-mandated in-app deletion (5.1.1(v)): reachable from the pairing screen, the
// enrollment screen and the profile menu. Confirmation is typing the account email.
export function DeleteAccount({ onSignOut, className }: { onSignOut: () => void | Promise<void>; className?: string }) {
  const d = useDeleteAccount(onSignOut);
  return (
    <>
      <Button variant="ghost" size="sm" className={className} onClick={() => { void d.show(); }}>Excluir conta</Button>
      <DeleteAccountModal d={d} />
    </>
  );
}

// Split from the button so a host that unmounts its own panel (the profile menu)
// can keep the dialog mounted outside it.
export function DeleteAccountModal({ d }: { d: ReturnType<typeof useDeleteAccount> }) {
  return (
    <>
      <Modal
        open={d.open}
        onClose={d.close}
        title="Excluir conta"
        icon="alertTriangle"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={d.close} disabled={d.busy}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={() => { void d.confirm(); }} disabled={!d.canConfirm} loading={d.busy}>Excluir minha conta</Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-neutral-300">
          Isso apaga seu login, o perfil, as preferências, as máquinas pareadas e os links de compartilhamento. Não dá pra desfazer.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-500">
          O que está na sua própria máquina (conversas, arquivos e código do agente) continua lá; para remover, apague no próprio servidor.
        </p>
        <label className="mt-4 block text-[12.5px] text-neutral-400">
          Para confirmar, digite <strong className="select-all text-neutral-200">{d.email}</strong>
          <Input
            className="mt-1.5"
            value={d.typed}
            onChange={(e) => d.setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            aria-label="Seu e-mail para confirmar"
          />
        </label>
        {d.err && <p role="alert" className="mt-3 text-[12.5px] text-red-300">{d.err}</p>}
      </Modal>
    </>
  );
}
