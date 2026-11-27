import { Icon, tokens } from '../primitives';
import { ComposerNotice } from './ComposerNotice';
import type { useScreenshotOffer } from './useScreenshotOffer';

type Offer = ReturnType<typeof useScreenshotOffer>;

const BTN = `rounded-md px-2.5 py-1 text-[13px] font-medium transition ${tokens.focusRing} ${tokens.touchTarget}`;

// Above the composer, iOS shell only (the hook is idle in a browser, so this renders nothing there).
export function ScreenshotPrompt({ s }: { s: Offer }) {
  if (!s.shell) return null;
  if (s.offer) {
    return (
      <div role="status" className="mb-2 flex items-center gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/[0.07] px-2.5 py-2 text-[13px] text-orange-100">
        <img src={s.offer.thumbnail} alt="Miniatura do print" className="h-12 w-9 shrink-0 rounded-sm object-cover" />
        <span className="flex-1 leading-snug">Colar o print no chat?</span>
        <button type="button" onClick={s.accept} className={`${BTN} bg-orange-500/80 text-neutral-950 hover:bg-orange-400`}>Colar</button>
        <button type="button" onClick={s.dismissOffer} className={`${BTN} text-orange-200/80 hover:bg-orange-500/15`}>Agora não</button>
      </div>
    );
  }
  if (s.showOptIn) {
    return (
      <ComposerNotice icon="image" tone="info" onDismiss={s.dismissOptIn}>
        Quer colar seus prints aqui? O Deck só olha a foto mais recente depois que você ativar.
        <button type="button" onClick={s.enable} className="ml-2 font-semibold underline underline-offset-2">Ativar prints automáticos</button>
      </ComposerNotice>
    );
  }
  if (s.optedIn && s.access === 'denied') {
    return (
      <ComposerNotice icon="image" tone="info" onDismiss={s.disable}>
        Sem acesso às fotos. Libere em Ajustes › Deck › Fotos para receber a oferta de prints.
      </ComposerNotice>
    );
  }
  if (s.optedIn && s.access === 'limited') {
    return (
      <ComposerNotice icon="image" tone="info" onDismiss={s.clearAccess}>
        Acesso limitado às fotos: prints novos podem não aparecer aqui. Libere todas em Ajustes › Deck › Fotos.
      </ComposerNotice>
    );
  }
  return null;
}
