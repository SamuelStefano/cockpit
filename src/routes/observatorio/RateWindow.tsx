import { Icon } from '../../components/primitives';
import { relReset } from '../observatorio.format';

// O CLI só manda { status, resetsAt } — NUNCA uma % de tokens. Então a barra é
// categórica (longe/perto/no limite), não um percentual fabricado.
export function RateWindow({ rate }: { rate: { resetsAt: number; status: string } }) {
  const limited = rate.status !== 'allowed';
  const fill = rate.status === 'allowed' ? 12 : rate.status.includes('warn') ? 66 : 100;
  const tone = !limited ? 'bg-emerald-500' : fill >= 100 ? 'bg-red-500' : 'bg-amber-500';
  const label = !limited ? 'longe do limite' : fill >= 100 ? 'no limite' : 'perto do limite';
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
          <Icon name="clock" size={12} /> janela de limite · {label}
        </span>
        <span className="font-mono text-[11px] text-neutral-400">reseta {relReset(rate.resetsAt)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${fill}%` }} />
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-neutral-600">
        O CLI do Claude não expõe a % exata de uso — só sinaliza quando está perto do teto. A barra reflete esse status, não um percentual de tokens.
      </p>
    </div>
  );
}
