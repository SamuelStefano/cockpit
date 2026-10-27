import { Button, CodeBlock, Input } from '../primitives';
import type { useEnrollDevice } from './useEnrollDevice';

// Fallback for a browser without passkey PRF: a one-time code shown on the
// box's own terminal, typed here. It never travels through the relay.
export function EnrollCodeForm({ e }: { e: ReturnType<typeof useEnrollDevice> }) {
  return (
    <>
      <p className="mb-5 mt-4 text-[13px] leading-relaxed text-neutral-400">
        Rode na VPS o comando abaixo e digite aqui o código que ele mostrar (vale uma vez, por 10 minutos).
      </p>
      <CodeBlock code={e.cli} lang="bash" />
      <div className="mt-5 space-y-3">
        <Input mono value={e.code} onChange={(ev) => e.setCode(ev.target.value)} placeholder="XXXX-XXXX-…" autoComplete="off" spellCheck={false} aria-label="Código de cadastro" error={!!e.err} />
        <Input value={e.label} onChange={(ev) => e.setLabel(ev.target.value)} placeholder="Nome deste aparelho" aria-label="Nome deste aparelho" />
        {e.err && <p className="text-[11.5px] text-red-300">{e.err}</p>}
        <Button variant="primary" loading={e.busy} disabled={!e.ready} onClick={() => void e.submit()}>{e.boxName ? `Cadastrar este aparelho em ${e.boxName}` : 'Cadastrar aparelho'}</Button>
      </div>
    </>
  );
}
