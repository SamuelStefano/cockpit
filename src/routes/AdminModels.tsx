import type { ModelInfo } from '../../shared/protocol';
import { Badge, Button, Icon, SectionHeader, Switch } from '../components/primitives';
import { prettyModel } from '../components/chat/toolbar-format';
import { AdminModelFamily } from './AdminModelFamily';
import { useAdminModels } from './useAdminModels';

export function AdminModels({ models }: { models: ModelInfo[] }) {
  const { catalog, hiddenCount, toggle, showAll } = useAdminModels(models);
  return (
    <div className="space-y-6">
      {catalog.allHidden && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-[12.5px] text-yellow-200">
          <Icon name="alertTriangle" size={14} />
          Todos os modelos estão ocultos — o seletor mostra todos até você ligar algum.
        </div>
      )}

      <section>
        <SectionHeader title="Anthropic · Claude" icon="claude" count={catalog.families.length} description="Escolha quais versões aparecem no seletor de versão do chat." />
        <div className="space-y-2">
          {catalog.families.map((f) => <AdminModelFamily key={f.key} family={f} onToggle={toggle} />)}
        </div>
      </section>

      <section>
        <SectionHeader title="Outros agentes" icon="sparkles" count={catalog.agents.length} description="Agentes ACP (Grok, Gemini…) instalados no host." />
        {catalog.agents.length === 0 ? (
          <p className="text-[12px] text-neutral-500">Nenhum agente instalado — veja a aba Agentes.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {catalog.agents.map((a) => (
              <Switch key={a.id} checked={a.shown} onChange={() => toggle(a.id)} icon="sparkles" label={prettyModel(a.id, a.displayName)} hint={a.id} />
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-4">
        <p className="flex items-center gap-2 text-[11.5px] text-neutral-500">
          Modelos novos aparecem automaticamente.
          {hiddenCount > 0 && <Badge tone="neutral">{hiddenCount} oculto{hiddenCount > 1 ? 's' : ''}</Badge>}
        </p>
        <Button variant="secondary" size="sm" icon="rotate" onClick={showAll} disabled={hiddenCount === 0}>Mostrar todos</Button>
      </div>
    </div>
  );
}
