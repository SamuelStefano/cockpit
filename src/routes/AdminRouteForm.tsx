import { Button, Input } from '../components/primitives';
import { useCustomRouteDraft, type CustomRouteAdd } from './useCustomRouteDraft';

// Provedor fora do catálogo: qualquer endpoint no formato da API Anthropic serve.
export function AdminRouteForm({ onAdd }: { onAdd: CustomRouteAdd }) {
  const { draft, error, set, submit } = useCustomRouteDraft(onAdd);

  return (
    <div className="mt-3">
      <h3 className="mb-1.5 text-[11px] uppercase tracking-wider text-neutral-500">Provedor próprio</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input size="sm" className="min-w-0 flex-1" placeholder="id" aria-label="id do provedor" value={draft.id} onChange={set('id')} />
        <Input size="sm" className="min-w-0 flex-[2]" placeholder="https://api.exemplo.com/anthropic" aria-label="base URL" value={draft.baseUrl} onChange={set('baseUrl')} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="modelo" aria-label="modelo" value={draft.model} onChange={set('model')} />
        <Input size="sm" className="min-w-0 flex-1" placeholder="ENV_DA_CHAVE" aria-label="nome da env da chave" value={draft.authEnv} onChange={set('authEnv')} />
        <Button variant="secondary" size="sm" onClick={submit}>Adicionar</Button>
      </div>
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
      <p className="mt-1 text-[11px] text-neutral-600">A chave em si vai em Tokens de ambiente — aqui só o nome da variável.</p>
    </div>
  );
}
