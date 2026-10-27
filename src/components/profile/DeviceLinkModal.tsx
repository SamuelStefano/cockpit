import { Button, Modal } from '../primitives';
import type { useDeviceLink } from './useDeviceLink';

// The QR an enrolled device shows so a new one can join by pointing its camera.
export function DeviceLinkModal({ l }: { l: ReturnType<typeof useDeviceLink> }) {
  return (
    <Modal open={l.open} onClose={l.close} title="Conectar outro aparelho" icon="smartphone" maxWidth="max-w-sm">
      <p className="text-[13px] leading-relaxed text-neutral-400">
        No aparelho novo, abra a câmera e aponte para o QR. Ele entra sozinho. Vale uma vez, por 10 minutos.
      </p>
      <div className="mt-4 flex flex-col items-center gap-3">
        {l.loading && <p className="py-16 text-[12.5px] text-neutral-500">gerando código…</p>}
        {l.err && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[12.5px] text-red-200">{l.err}</p>}
        {l.qr && <img src={l.qr} alt="QR para conectar outro aparelho" className="h-56 w-56 rounded-lg bg-white" />}
        {l.code && !l.expired && <p className="text-[12px] text-neutral-500">expira em {l.countdown}</p>}
        {l.expired && <p className="py-6 text-[12.5px] text-neutral-400">Este código expirou.</p>}
        {(l.expired || l.err) && <Button variant="primary" size="sm" icon="rotate" onClick={l.again}>Gerar outro</Button>}
        {l.code && !l.expired && (
          <>
            <Button variant="secondary" size="sm" icon="link" onClick={l.copy}>Copiar link</Button>
            <details className="w-full text-[11.5px] text-neutral-500">
              <summary className="cursor-pointer">Mostrar o código</summary>
              <p className="mt-1 break-all font-mono text-neutral-300 select-all">{l.code}</p>
              <p className="mt-1">Digite em “Outro método” no aparelho novo, se a câmera não abrir o link.</p>
            </details>
          </>
        )}
      </div>
    </Modal>
  );
}
