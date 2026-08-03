import { Badge, Button, Icon } from '../components/primitives';
import type { RouteView } from '../../shared/protocol';
import { routeStatus, statusTone, cooldownLabel } from './admin-routes';

export function RouteRow({ r, onSet, onConfig, onRemove }: {
  r: RouteView;
  onSet: (id: string) => void;
  onConfig: (id: string, patch: { enabled?: boolean; priority?: number }) => void;
  onRemove: (id: string) => void;
}) {
  const status = routeStatus(r);
  const cool = cooldownLabel(r.cooldownUntil);
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-2">
      <span className="w-7 shrink-0 text-right font-mono text-[11px] text-neutral-600">{r.priority}</span>
      <span className="text-[12.5px] text-neutral-200">{r.label}</span>
      <Badge tone={statusTone(status)}>{status}{cool ? ` ${cool}` : ''}</Badge>
      {r.authEnv && !r.configured && <span className="font-mono text-[10.5px] text-neutral-600">falta {r.authEnv}</span>}
      <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-neutral-600">{r.models}</span>
      <a href={r.docsUrl} target="_blank" rel="noreferrer" title="Como pegar a chave" className="text-neutral-600 hover:text-orange-400">
        <Icon name="file" size={12} />
      </a>
      <Button
        variant="ghost" size="sm"
        title={r.enabled ? 'Tirar do rodízio' : 'Colocar no rodízio'}
        onClick={() => onConfig(r.id, { enabled: !r.enabled })}
      >
        {r.enabled ? 'desligar' : 'ligar'}
      </Button>
      <Button variant="secondary" size="sm" disabled={r.active || !r.configured} onClick={() => onSet(r.id)}>
        usar
      </Button>
      {r.custom && (
        <button type="button" onClick={() => onRemove(r.id)} title={`Remover ${r.label}`} className="text-neutral-600 hover:text-red-300">
          <Icon name="x" size={12} />
        </button>
      )}
    </li>
  );
}
