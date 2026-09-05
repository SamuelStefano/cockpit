import { Icon } from '../primitives/Icon';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

const TONE: Record<string, string> = {
  [RUNNING_LABEL]: 'text-green-400/90',
  // Violeta, e não laranja: o ponto da linha que sinaliza "parou numa pergunta"
  // já é violeta, e laranja aqui competia com o ativo e a estrela de fixada —
  // três laranjas na mesma coluna e nenhum deles significando a mesma coisa.
  [WAITING_LABEL]: 'text-violet-300',
};

// `inset` = cabeçalho DENTRO do bloco de estado (ver [[SessionGroup]]): ali não
// gruda no topo nem sangra pras bordas do painel, senão a caixa se rasga ao rolar.
export function SessionGroupHeader({ label, count, inset = false }: { label: string; count: number; inset?: boolean }) {
  const box = inset
    ? 'px-1.5 pb-0.5 pt-0.5'
    : 'sticky top-0 z-1 -mx-2.5 bg-neutral-950/95 px-3.5 pb-1 pt-2 backdrop-blur-xs';
  return (
    <div className={`flex items-center gap-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] ${box} ${TONE[label] ?? 'text-neutral-500'}`}>
      {label === RUNNING_LABEL && <span className="breathe h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />}
      {label === WAITING_LABEL && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />}
      {label === 'Fixadas' && <Icon name="star" size={9} className="shrink-0 text-orange-400/80" />}
      <span className="shrink-0">{label}</span>
      <span className={`shrink-0 font-medium tabular-nums ${inset ? 'text-current opacity-60' : 'text-neutral-600'}`}>{count}</span>
      {!inset && <span className="h-px min-w-3 flex-1 bg-linear-to-r from-neutral-800 to-transparent" />}
    </div>
  );
}
