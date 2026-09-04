import { Icon } from '../primitives';
import type { ComposerCost } from './send-cost';

interface SendCostNoticeProps {
  cost: ComposerCost | null;
}

// Preço do próximo envio, acima do compositor.
//
// O SaturationBanner responde "esta sessão está cheia?". Este responde "quanto
// custa mandar isto AGORA?" — e a resposta depende da temperatura do cache, não
// só do tamanho. Em 04/09/2026 quatro sessões idênticas às da véspera custaram
// 12x mais só por estarem paradas há horas, e nada na tela dizia isso.
export function SendCostNotice({ cost }: SendCostNoticeProps) {
  if (!cost) return null;
  const grave = !cost.fits;
  const tone = grave
    ? { border: 'border-red-500/30', bg: 'bg-red-500/[0.07]', text: 'text-red-200', icon: 'text-red-400' }
    : { border: 'border-orange-500/25', bg: 'bg-orange-500/[0.07]', text: 'text-orange-100/80', icon: 'text-orange-400' };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-1.5">
      <div className={`flex items-start gap-2 rounded-lg border ${tone.border} ${tone.bg} px-2.5 py-1.5 text-[11.5px] leading-snug ${tone.text}`}>
        <Icon name="zap" size={12} className={`mt-0.5 shrink-0 ${tone.icon}`} />
        <span className="flex-1">
          {grave
            ? `Este envio custa ${cost.label} e não cabe no que sobrou da janela — o servidor vai recusar.`
            : `Próximo envio: ${cost.label}.`}
          {cost.cost.cold && !grave && ' Migrar a sessão sai mais barato que continuar.'}
        </span>
      </div>
    </div>
  );
}
