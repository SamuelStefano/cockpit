import { Icon } from '../primitives';

// Aviso de cota do DESKTOP, num slot da StatusBar. Era `absolute bottom-3 right-3
// z-30` sobre o painel: com o teclado aberto no celular o viewport encolhe e a
// pílula caía exatamente sobre a última mensagem. No mobile o aviso agora vive na
// UsageBar do header, que já está sempre à vista.
export function QuotaBanner({ onClose, reset }: { onClose: () => void; reset: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-sm border border-yellow-500/25 bg-yellow-500/10 px-1.5 py-0.5 text-yellow-200/80">
      <Icon name="zap" size={11} className="shrink-0 text-yellow-400/80" />
      <span className="truncate font-mono text-[10px]">uso próximo do limite · reseta {reset}</span>
      <button
        onClick={onClose}
        title="Dispensar"
        aria-label="Dispensar aviso de uso"
        className="shrink-0 rounded-sm p-0.5 text-yellow-200/50 transition hover:bg-yellow-500/10 hover:text-yellow-200"
      >
        <Icon name="x" size={11} />
      </button>
    </span>
  );
}
