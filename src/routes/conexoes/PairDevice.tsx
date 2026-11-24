import { Button } from '../../components/primitives';
import { DeviceLinkModal } from '../../components/profile/DeviceLinkModal';
import { useDeviceLink } from '../../components/profile/useDeviceLink';

export function PairDevice({ link }: { link: ReturnType<typeof useDeviceLink> }) {
  return (
    <>
      <h2 className="mb-2 mt-6 text-[13px] font-medium text-neutral-400">Conectar um aparelho</h2>
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        <ol className="m-0 min-w-0 flex-1 list-decimal pl-5 text-[13px] leading-[1.7] text-neutral-400">
          <li>Abra a câmera do celular e aponte para o código.</li>
          <li>Toque no link que aparecer. Ele vale por 10 minutos.</li>
          <li>O Deck abre já com a sua conta — sem senha.</li>
        </ol>
        <Button icon="smartphone" variant="secondary" onClick={link.start}>Mostrar o código</Button>
        <p className="basis-full text-[12px] text-neutral-500">Só pareie aparelhos seus. Remova aqui quando perder ou trocar de celular.</p>
      </div>
      <DeviceLinkModal l={link} />
    </>
  );
}
