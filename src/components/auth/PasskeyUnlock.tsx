import { Button } from '../primitives';
import type { PasskeySetup } from './usePasskeySetup';

// Passkey of the account → this browser's device key. Every browser the passkey
// syncs to opens the Deck with no command on the VPS once a box trusts it.
export function PasskeyUnlock({ pk }: { pk: PasskeySetup }) {
  if (pk.active) {
    return <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12.5px] leading-relaxed text-emerald-200">Passkey ativa neste navegador.</p>;
  }
  if (pk.unsupported) {
    return (
      <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-200">
        Este navegador não oferece a extensão de passkey que o Deck usa (PRF).
      </p>
    );
  }
  if (!pk.offer) return null;
  return (
    <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <p className="text-[12.5px] leading-relaxed text-neutral-400">
        Use a passkey da sua conta: este navegador e todo navegador onde ela sincroniza abrem o Deck sem rodar comando na VPS.
      </p>
      {pk.confirming ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
          <p className="text-[12px] leading-relaxed text-amber-200">
            Uma passkey nova substitui a chave deste aparelho em todo navegador onde a antiga sincroniza. Se você já usa uma passkey no Deck, prefira “Usar passkey”.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" loading={pk.busy} onClick={pk.create}>Criar e substituir</Button>
            <Button size="sm" variant="ghost" disabled={pk.busy} onClick={pk.cancelCreate}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" loading={pk.busy} onClick={pk.use}>Usar passkey</Button>
          <Button size="sm" variant="ghost" disabled={pk.busy} onClick={pk.askCreate}>Criar passkey nova…</Button>
        </div>
      )}
      {pk.err && <p className="mt-2 text-[11.5px] text-red-300">{pk.err}</p>}
    </div>
  );
}
