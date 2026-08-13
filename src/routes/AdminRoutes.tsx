import { useEffect } from 'react';
import { Button, Icon } from '../components/primitives';
import type { RoutesSnapshot } from '../../shared/protocol';
import { sortRoutes, cascadeHint } from './admin-routes';
import { RouteRow } from './RouteRow';
import { AdminRouteForm } from './AdminRouteForm';
import type { CustomRouteAdd } from './useCustomRouteDraft';

interface AdminRoutesProps {
  routes: RoutesSnapshot | null;
  onRoutesGet: () => void;
  onRoutesEnable: (on: boolean) => void;
  onRoutesCascade: (on: boolean) => void;
  onRouteSet: (id: string) => void;
  onRouteConfig: (id: string, patch: { enabled?: boolean; priority?: number }) => void;
  onRouteCustomAdd: CustomRouteAdd;
  onRouteCustomRemove: (id: string) => void;
}

export function AdminRoutes({ routes, onRoutesGet, onRoutesEnable, onRoutesCascade, onRouteSet, onRouteConfig, onRouteCustomAdd, onRouteCustomRemove }: AdminRoutesProps) {
  useEffect(() => { onRoutesGet(); }, [onRoutesGet]);

  const enabled = !!routes?.enabled;
  const cascade = !!routes?.cascade;
  const list = routes ? sortRoutes(routes.routes) : [];

  return (
    <div className="mb-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <h2 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
        <Icon name="zap" size={12} /> Rotas de provedor
      </h2>
      <p className="mb-3 text-[12px] leading-relaxed text-neutral-500">
        Quando o plano bate no teto, o turno migra sozinho para a próxima rota ligada e volta ao
        plano assim que a janela reseta. Menor prioridade tenta primeiro.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <Button variant={enabled ? 'primary' : 'secondary'} size="sm" icon={enabled ? 'check' : 'x'} onClick={() => onRoutesEnable(!enabled)}>
          {enabled ? 'Troca automática ligada' : 'Troca automática desligada'}
        </Button>
        <Button variant="ghost" size="sm" icon="rotate" title="Recarregar rotas" onClick={onRoutesGet}>Atualizar</Button>
      </div>

      <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <Button variant={cascade ? 'primary' : 'secondary'} size="sm" icon={cascade ? 'check' : 'x'} onClick={() => onRoutesCascade(!cascade)}>
            {cascade ? 'Cascata ligada' : 'Cascata desligada'}
          </Button>
        </div>
        <p className="text-[12px] leading-relaxed text-neutral-500">
          Tenta cada turno primeiro no provedor barato e refaz no plano se ele não entregar. {cascadeHint(routes)}
        </p>
      </div>

      {!routes ? (
        <p className="text-[12px] text-neutral-600">carregando…</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((r) => (
            <RouteRow key={r.id} r={r} onSet={onRouteSet} onConfig={onRouteConfig} onRemove={onRouteCustomRemove} />
          ))}
        </ul>
      )}

      <AdminRouteForm onAdd={onRouteCustomAdd} />
    </div>
  );
}
