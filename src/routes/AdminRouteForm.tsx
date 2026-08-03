import { useState } from 'react';
import { Button, Input } from '../components/primitives';
import { validateCustom, type CustomDraft } from './admin-routes';
import type { ClientMsg } from '../../shared/protocol';

const EMPTY: CustomDraft = { id: '', baseUrl: '', model: '', authEnv: '' };

// Provedor fora do catálogo: qualquer endpoint no formato da API Anthropic serve.
export function AdminRouteForm({ onAdd }: { onAdd: (r: Omit<Extract<ClientMsg, { t: 'route-custom-add' }>, 't'>) => void }) {
  const [d, setD] = useState<CustomDraft>(EMPTY);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const problem = validateCustom(d);
    setErr(problem);
    if (problem) return;
    onAdd({ id: d.id.trim(), baseUrl: d.baseUrl.trim(), model: d.model.trim(), authEnv: d.authEnv.trim() || undefined });
    setD(EMPTY);
  };

  const set = (k: keyof CustomDraft) => (e: React.ChangeEvent<HTMLInputElement>) => { setD({ ...d, [k]: e.target.value }); setErr(null); };

  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">Provedor próprio</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input size="sm" className="min-w-0 flex-1" placeholder="id" aria-label="id do provedor" value={d.id} onChange={set('id')} />
        <Input size="sm" className="min-w-0 flex-[2]" placeholder="https://api.exemplo.com/anthropic" aria-label="base URL" value={d.baseUrl} onChange={set('baseUrl')} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="modelo" aria-label="modelo" value={d.model} onChange={set('model')} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="ENV_DA_CHAVE" aria-label="nome da env da chave" value={d.authEnv} onChange={set('authEnv')} />
        <Button variant="secondary" size="sm" onClick={submit}>Adicionar</Button>
      </div>
      {err && <p className="mt-1 text-[11px] text-red-300">{err}</p>}
      <p className="mt-1 text-[11px] text-neutral-600">A chave em si vai em Tokens de ambiente — aqui só o nome da variável.</p>
    </div>
  );
}
