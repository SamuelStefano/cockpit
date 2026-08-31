import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { ctrlBtn } from './ErrorOverlay';
import { VIEWPORTS } from './viewports';
import { useSandboxPreview } from './useSandboxPreview';
import type { SandboxTarget } from '../../../../shared/sandbox-preview';

// `allow-same-origin` aqui NÃO é furo: o src é de outra origem, então a permissão
// vale pra origem do próprio preview (o app precisa dela pra cookie/localStorage, ou
// o login não sobrevive). O que protege o Deck é a origem ser diferente. Fica de fora
// `allow-top-navigation`, senão o app embutido conseguiria trocar a página do Deck.
const SANDBOX_PERMS = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads';

function Frame({ src, title, className, width }: { src: string; title: string; className: string; width: number | null }) {
  return (
    <iframe
      src={src}
      title={title}
      sandbox={SANDBOX_PERMS}
      referrerPolicy="no-referrer"
      allow="clipboard-write; fullscreen"
      className={className}
      style={width ? { width, maxWidth: '100%' } : undefined}
    />
  );
}

// Abre um app que já está no ar (preview de PR, staging, dev server) dentro da bolha
// do chat, navegável como se fosse localhost. Nada é compilado aqui: só embute a URL.
export function SandboxPreview({ target }: { target: SandboxTarget }) {
  const { vp, setVp, full, setFull, nonce, reload, width, src, proxied, probing } = useSandboxPreview(target);
  const title = `sandbox ${target.host}`;

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-orange-500/25 bg-[#0c0c0c]">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-neutral-800 px-3 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-orange-300/80">
          <Icon name="monitor" size={11} className="shrink-0" />
          <span className="truncate" title={target.url}>sandbox · {target.host}</span>
          {!probing && !proxied && (
            <span className="shrink-0 normal-case tracking-normal text-amber-400/70"
              title="Sem o proxy do Deck o navegador trata o app como terceiro: cookie de sessão bloqueado e login não gruda. Rode `npm run redeploy` no cockpit.">
              · sem sessão
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
            {VIEWPORTS.map((v) => (
              <button key={v.id} onClick={() => setVp(v.id)} title={v.label} aria-pressed={vp === v.id}
                className={`rounded p-1 transition ${vp === v.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`}>
                <Icon name={v.icon} size={11} />
              </button>
            ))}
          </div>
          <button onClick={reload} title="Recarregar" className={ctrlBtn(false)}><Icon name="rotate" size={12} /></button>
          <a href={target.url} target="_blank" rel="noreferrer noopener" title="Abrir em outra aba" className={`${ctrlBtn(false)} inline-flex`}>
            <Icon name="link" size={12} />
          </a>
          <button onClick={() => setFull(true)} title="Tela cheia" className={ctrlBtn(false)}><Icon name="maximize" size={12} /></button>
        </div>
      </div>

      {probing ? (
        <div className="px-3 py-6 text-center font-mono text-[11px] text-neutral-600">preparando…</div>
      ) : full ? (
        <div className="px-3 py-6 text-center font-mono text-[11px] text-neutral-600">aberto em tela cheia…</div>
      ) : (
        <div className="flex justify-center bg-white">
          <Frame key={nonce} src={src} title={title} width={width} className="h-[560px] w-full border-0" />
        </div>
      )}

      <Modal open={full} onClose={() => setFull(false)} title={`Sandbox — ${target.host}`} icon="monitor" maxWidth="max-w-[96vw]">
        <div className="flex h-[82vh] justify-center overflow-hidden rounded-lg border border-neutral-800 bg-white">
          <Frame key={`full-${nonce}`} src={src} title={title} width={width} className="h-full w-full border-0" />
        </div>
      </Modal>
    </div>
  );
}
