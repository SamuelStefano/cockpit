import { Badge, Icon } from '../../components/primitives';
import type { ProviderUsage } from '../../../shared/protocol';
import { fmtNum as fmt, usd } from '../observatorio.format';

const LABEL: Record<string, string> = {
  'anthropic-plan': 'Anthropic (plano)',
  'anthropic-api': 'Anthropic (API)',
  openrouter: 'OpenRouter',
  'zai-glm': 'Z.AI GLM',
  'qwen-coder': 'Qwen3 Coder',
  minimax: 'MiniMax M2',
  'moonshot-kimi': 'Moonshot Kimi',
  deepseek: 'DeepSeek',
};

export function ProviderSplit({ providers }: { providers: ProviderUsage[] }) {
  const totalOut = providers.reduce((a, p) => a + p.outputTokens, 0) || 1;
  return (
    <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <span className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-neutral-500">
        <Icon name="zap" size={12} /> saída por provedor
      </span>
      <div className="flex flex-col gap-2.5">
        {providers.map((p) => (
          <div key={p.providerId} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-xs text-neutral-300">{LABEL[p.providerId] ?? p.providerId}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div
                className={`h-full rounded-full ${p.costUsd === 0 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.round((p.outputTokens / totalOut) * 100)}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right font-mono text-[11px] text-neutral-400">{fmt(p.outputTokens)}</span>
            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-neutral-400">{usd(p.costUsd)}</span>
            {p.costUsd === 0 && <Badge tone="green">grátis</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}
