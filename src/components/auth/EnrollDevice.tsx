import { BrandMark, Button } from '../primitives';
import { useEnrollDevice } from './useEnrollDevice';
import { usePasskeySetup } from './usePasskeySetup';
import { EnrollCodeForm } from './EnrollCodeForm';
import { EnrollLinkStatus } from './EnrollLinkStatus';

// Shown when the agent does not know this device yet (or refused its key). The
// normal way in is a QR shown by an enrolled device (this browser then enrolls
// itself, see useEnrollLink) or a synced passkey. The code from the box's
// terminal stays as a fallback behind "outro método".
export function EnrollDevice({ onSignOut }: { onSignOut: () => void }) {
  const e = useEnrollDevice();
  const pk = usePasskeySetup();
  const rejected = e.state === 'rejected';
  const unsupported = e.state === 'unsupported';

  return (
    <div className="flex h-full flex-1 justify-center overflow-y-auto bg-neutral-950 px-4 py-6">
      <div className="my-auto w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-2xl sm:p-7">
        <BrandMark title={e.boxName ? `cadastrar este aparelho em ${e.boxName}` : 'cadastrar este aparelho'} bitState="connecting" />
        {rejected && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12.5px] leading-relaxed text-red-200">
            A chave que respondeu não é a da sua VPS cadastrada. Ou o agente foi reinstalado, ou alguém está no meio do caminho. Gere um código novo na VPS e cadastre de novo.
          </p>
        )}
        {unsupported && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-200">
            O agente na sua VPS não respondeu ao canal cifrado. Atualize o agente e tente de novo.
          </p>
        )}
        <EnrollLinkStatus />
        {!e.showCode && (
          <>
            <p className="mt-4 text-[13px] leading-relaxed text-neutral-400">
              Abra o Deck num aparelho já cadastrado, toque em <strong className="text-neutral-200">Conectar outro aparelho</strong> (menu do perfil) e aponte a câmera deste aparelho para o QR.
            </p>
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={e.showOther}>Outro método</Button>
            </div>
          </>
        )}
        {e.showCode && <EnrollCodeForm e={e} />}
        <div className="mt-6 flex justify-end border-t border-neutral-800 pt-4">
          <Button variant="ghost" size="sm" onClick={onSignOut}>Sair</Button>
        </div>
      </div>
    </div>
  );
}
