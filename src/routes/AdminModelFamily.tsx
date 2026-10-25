import { Switch } from '../components/primitives';
import { prettyModel } from '../components/chat/toolbar-format';
import type { CatalogFamily } from '../lib/model-visibility';

export function AdminModelFamily({ family, onToggle }: { family: CatalogFamily; onToggle: (key: string) => void }) {
  const name = family.family[0].toUpperCase() + family.family.slice(1);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-2 hairline">
      <Switch
        checked={family.shown}
        onChange={() => onToggle(family.key)}
        icon="claude"
        label={`Mostrar ${name}`}
        hint={family.shown ? 'Desligar oculta todas as versões, inclui versões futuras' : 'Família oculta, inclui versões futuras'}
      />
      {family.shown && (
        <div className="mt-1.5 grid gap-1.5 pl-5 sm:grid-cols-2">
          {family.versions.map((v) => (
            <Switch key={v.id} checked={v.shown} onChange={() => onToggle(v.id)} label={prettyModel(v.id, v.displayName)} hint={v.id} />
          ))}
        </div>
      )}
    </div>
  );
}
