import { Button, Icon } from '../primitives';

// Aviso de versão nova pra PWA instalada, que nunca recarrega sozinha. Não bloqueia
// nada: um turno pode estar rodando, e recarregar no meio dele é decisão do dono.
export function UpdateNotice({ show, onApply, onDismiss }: { show: boolean; onApply: () => void; onDismiss: () => void }) {
  if (!show) return null;
  return (
    <div className="fade-up pointer-events-none absolute left-1/2 top-2.5 z-40 w-[min(92vw,30rem)] -translate-x-1/2 max-lg:static max-lg:w-full max-lg:translate-x-0">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/12 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur-md max-lg:min-h-11 max-lg:rounded-none max-lg:border-x-0 max-lg:border-t-0 max-lg:py-1 max-lg:shadow-none">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-500/15 text-orange-400">
          <Icon name="rotate" size={13} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-tight text-orange-100">
          Versão nova do Deck disponível.
          <span className="block text-[12px] text-orange-200/70 max-lg:hidden">Recarregue quando puder — nada é interrompido antes disso.</span>
        </p>
        <Button size="sm" onClick={onApply}>Recarregar</Button>
        <Button variant="ghost" size="sm" square icon="x" aria-label="Dispensar" onClick={onDismiss} />
      </div>
    </div>
  );
}
