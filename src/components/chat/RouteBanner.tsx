import { Icon, Badge, tokens } from '../primitives';
import { routeBanner, tierLabel, tierTone } from './route-status';
import type { RoutesSnapshot } from '../../../shared/protocol';

// Aviso de que o turno está rodando FORA do plano Anthropic. Só aparece quando há
// troca em vigor: no plano o silêncio é o estado correto.
export function RouteBanner({ routes, onOpenAdmin }: { routes: RoutesSnapshot | null; onOpenAdmin?: () => void }) {
  const view = routeBanner(routes);
  if (!view) return null;
  return (
    <div className={`mb-2 flex items-center gap-2 px-2.5 py-1.5 text-[11px] ${tokens.radius.md} ${tokens.surface.base} ${tokens.text.secondary}`}>
      <Icon name="zap" size={12} className="shrink-0 text-orange-400/80" />
      <span className="font-medium">{view.label}</span>
      <Badge tone={tierTone(view.tier)}>{tierLabel(view.tier)}</Badge>
      <span className={`min-w-0 truncate ${tokens.text.muted}`}>{view.detail}</span>
      {onOpenAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className={`ml-auto shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] transition hover:bg-neutral-800 ${tokens.focusRing}`}
        >
          rotas
        </button>
      )}
    </div>
  );
}
