import { useState } from 'react';
import type { ByoKeyView, ByoProvider } from '../../../shared/byo-providers';
import { Badge, Button, Input } from '../primitives';

interface ByoKeyRowProps {
  provider: ByoProvider;
  view?: ByoKeyView;
  onSave: (key: string) => boolean;
  onRemove: () => void;
}

export function ByoKeyRow({ provider, view, onSave, onRemove }: ByoKeyRowProps) {
  const [key, setKey] = useState('');
  const submit = () => {
    if (key.trim() && onSave(key.trim())) setKey('');
  };
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-neutral-100">{provider.name}</span>
        {view?.configured
          ? <Badge tone="green" dot className="ml-auto">Chave salva · final {view.last4}</Badge>
          : <Badge tone="neutral" dot className="ml-auto">Sem chave</Badge>}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
        {provider.blurb}{' '}
        <a href={provider.keyUrl} target="_blank" rel="noreferrer noopener" className="text-orange-400 hover:underline">Criar chave</a>
      </p>
      <form className="mt-2 flex gap-2" autoComplete="off" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Input
          type="password" mono size="sm" autoComplete="off" spellCheck={false}
          aria-label={`Chave de API do ${provider.name}`}
          placeholder={view?.configured ? 'Colar nova chave para trocar' : 'Colar a chave de API'}
          value={key} onChange={(e) => setKey(e.target.value)} className="flex-1"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!key.trim()}>Salvar</Button>
        {view?.configured && <Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remover</Button>}
      </form>
    </div>
  );
}
