import { BrandMark, Button, CodeBlock, Input } from '../primitives';
import { useEnrollDevice } from './useEnrollDevice';
import { usePasskeySetup } from './usePasskeySetup';
import { PasskeyUnlock } from './PasskeyUnlock';

// Shown when the agent does not know this device yet (or refused its key). The
// code comes from the box itself, never through the relay: that is what lets
// the browser and the agent trust each other's keys without trusting the relay.
export function EnrollDevice({ onSignOut }: { onSignOut: () => void }) {
  const e = useEnrollDevice();
  const pk = usePasskeySetup();
  const rejected = e.state === 'rejected';
  const unsupported = e.state === 'unsupported';

  return (
    <div className="flex h-full flex-1 justify-center overflow-y-auto bg-neutral-950 px-4 py-6">
      <div className="my-auto w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-2xl sm:p-7">
        <BrandMark title={e.boxName ? `cadastrar este aparelho em ${e.boxName}` : 'cadastrar este aparelho'} subtitle="conexão cifrada de ponta a ponta com a sua VPS" bitState="connecting" />
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
        <PasskeyUnlock pk={pk} />
        <p className="mb-5 mt-4 text-[13px] leading-relaxed text-neutral-400">
          O relay só repassa bytes cifrados. Rode na VPS o comando abaixo e digite aqui o código que ele mostrar (vale uma vez, por 10 minutos). Com passkey, isso é preciso só uma vez por VPS; sem passkey, uma vez por navegador.
        </p>
        <CodeBlock code={e.cli} lang="bash" />
        <div className="mt-5 space-y-3">
          <Input mono value={e.code} onChange={(ev) => e.setCode(ev.target.value)} placeholder="XXXX-XXXX-…" autoComplete="off" spellCheck={false} aria-label="Código de cadastro" error={!!e.err} />
          <Input value={e.label} onChange={(ev) => e.setLabel(ev.target.value)} placeholder="Nome deste aparelho" aria-label="Nome deste aparelho" />
          {e.err && <p className="text-[11.5px] text-red-300">{e.err}</p>}
          <Button variant="primary" loading={e.busy} disabled={!e.ready} onClick={() => void e.submit()}>{e.boxName ? `Cadastrar este aparelho em ${e.boxName}` : 'Cadastrar aparelho'}</Button>
        </div>
        <div className="mt-6 flex justify-end border-t border-neutral-800 pt-4">
          <Button variant="ghost" size="sm" onClick={onSignOut}>Sair</Button>
        </div>
      </div>
    </div>
  );
}
