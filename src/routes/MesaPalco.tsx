import { SandboxPreview } from '../components/primitives/livepreview/SandboxPreview';
import { parseSandboxTarget } from '../../shared/sandbox-preview';
import { usePersisted } from '../lib/persist';

function loopback(host: string): boolean {
  const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
  return name === 'localhost' || name === '127.0.0.1' || name === '0.0.0.0' || name === '::1';
}

export function MesaPalco() {
  const [url, setUrl] = usePersisted('mesa.preview', '');
  const target = parseSandboxTarget(url);
  const local = target ? loopback(target.host) : false;
  return (
    <section className="flex max-h-[46%] min-h-48 shrink-0 flex-col border-t border-neutral-800">
      <label className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400" htmlFor="mesa-url">Palco</label>
      <input
        id="mesa-url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://… ou http://127.0.0.1:5199"
        className="mx-3 mt-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-[12px] text-neutral-200 outline-hidden focus:border-orange-500/50"
      />
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {local && (
          <p className="mb-2 text-[12px] leading-relaxed text-amber-300/90">
            No navegador desta box o localhost abre. No celular ou no seu PC, esse endereço é a sua máquina.
          </p>
        )}
        {target ? (
          <SandboxPreview target={target} />
        ) : (
          <p className="text-[12px] leading-relaxed text-neutral-500">
            Cole a URL do app que já está no ar. A prévia usa essa página, sem compilar o diff daqui.
          </p>
        )}
      </div>
    </section>
  );
}
