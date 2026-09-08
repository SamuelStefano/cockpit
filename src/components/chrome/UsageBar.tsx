import { relReset, relAge } from '../../lib/time';
import { tokens } from '../primitives';
import { usageRows, toneOf, isStalePlanUsage, isOldReading } from './usage-rows';
import { quotaBorder } from './quota-tone';
import { useUsagePanel } from './useUsagePanel';
import { UsagePanel } from './UsagePanel';
import type { PlanUsage } from '../../../shared/protocol';

const BAR = { ok: 'bg-emerald-500', mid: 'bg-amber-500', high: 'bg-red-500' } as const;
const TEXT = { ok: 'text-emerald-300', mid: 'text-amber-300', high: 'text-red-300' } as const;

// Uso GLOBAL do plano (claude.ai/settings/usage) + tempo de reset. SEMPRE à vista
// no header, em qualquer rota (#183): nunca some. Enquanto o número não chega do
// poll OAuth, mostra placeholder ("—") em vez de sumir — assim o indicador é uma
// âncora fixa, não algo que pisca pra fora ao sair do chat. Clicar abre o detalhe
// com a janela semanal e os tetos por modelo, que não cabem no chip.
interface UsageBarProps {
  usage: PlanUsage | null;
  compact: boolean;
  // Estado do gate de cota (useQuotaGate): no mobile a barra é o único aviso.
  warn?: boolean;
  paused?: boolean;
  quotaResetsAt?: number | null;
  // 429 no endpoint de usage: até quando o servidor não vai tentar de novo.
  blockedUntil?: number | null;
  // Quando o número foi lido da conta. Leitura velha é mostrada como velha.
  readAt?: number | null;
  // Pede um número fresco ao servidor (abertura do painel + enquanto ele fica aberto).
  onRefresh?: () => void;
}

export function UsageBar({ usage, compact, warn = false, paused = false, quotaResetsAt = null, blockedUntil = null, readAt = null, onRefresh }: UsageBarProps) {
  const { open, setOpen, wrapRef } = useUsagePanel(onRefresh);
  const rows = usageRows(usage);
  const stale = isStalePlanUsage(usage);
  // Janela virada = o número não descreve mais nada, some. Leitura só VELHA
  // continua na tela: ela ainda é o melhor palpite, só não pode se passar por
  // atual — vai em cinza e com a idade no lugar do "reset em".
  const old = isOldReading(readAt);
  const pct = usage && !stale ? usage.fiveHour : null;
  const tone = pct === null || old ? null : toneOf(pct);
  const bar = tone === null ? 'bg-neutral-700' : BAR[tone];
  const text = tone === null ? 'text-neutral-500' : TEXT[tone];
  const age = old && readAt ? relAge(readAt) : '';
  const reset = usage && usage.resetsAt && !stale && !old ? relReset(usage.resetsAt) : '';
  const gateReset = quotaResetsAt ? relReset(quotaResetsAt) : '';

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={paused ? `Cota esgotada${gateReset ? ` — reseta ${gateReset}` : ''}` : warn ? `Uso próximo do limite${gateReset ? ` — reseta ${gateReset}` : ''}` : stale ? 'Uso do plano: a janela virou e o número novo ainda não chegou da conta' : old ? `Uso do plano: número lido há ${age} — a leitura nova não chegou` : usage ? 'Ver detalhe do uso do plano' : 'Uso do plano: lendo da conta…'}
        className={`flex items-center border bg-neutral-900/60 py-1.5 transition-colors hover:bg-neutral-900 ${quotaBorder(warn, paused)} ${tokens.radius.md} ${tokens.focusRing} ${compact ? 'gap-1.5 px-2' : 'gap-2 px-2.5'}`}
      >
        {paused && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-400" />}
        {!compact && <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Usage</span>}
        <div className={`${compact ? 'w-12' : 'w-20'} h-2 overflow-hidden rounded-full bg-neutral-800`}>
          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct ?? 0}%` }} />
        </div>
        <span className={`text-[11px] font-medium tabular-nums ${text}`}>{pct === null ? '—' : `${pct}%`}</span>
        {reset && !compact && (
          <span className="text-[10px] tabular-nums text-neutral-500">reset {reset}</span>
        )}
        {age && !compact && (
          <span className="text-[10px] tabular-nums text-neutral-600">há {age}</span>
        )}
      </button>
      {open && <UsagePanel rows={rows} reset={gateReset} warn={warn || paused} blockedUntil={blockedUntil} readAt={readAt} />}
    </div>
  );
}
