import { Button, Input } from '../primitives';
import { useVaultForm } from './useVaultForm';
import type { VaultApi } from '../../cockpit/useVault';

export function VaultForm({ api, open }: { api: VaultApi; open: boolean }) {
  const f = useVaultForm(api, open);

  return (
    <div>
      <label htmlFor="vault-name" className="block text-[12px] font-medium text-neutral-500">Nome da variável</label>
      <Input id="vault-name" size="sm" mono className="mt-1" value={f.name} maxLength={64} onChange={(e) => f.setName(e.target.value)} placeholder="GITHUB_TOKEN" />
      <label htmlFor="vault-value" className="mt-3 block text-[12px] font-medium text-neutral-500">Valor (só escrita)</label>
      <Input id="vault-value" size="sm" mono type="password" autoComplete="off" className="mt-1" value={f.value} onChange={(e) => f.setValue(e.target.value)} placeholder="••••••••" />
      <label htmlFor="vault-agents" className="mt-3 block text-[12px] font-medium text-neutral-500">Agentes com acesso</label>
      <Input id="vault-agents" size="sm" mono className="mt-1" value={f.agents} onChange={(e) => f.setAgents(e.target.value)} placeholder="claude, grok" />
      {f.erro && <p role="alert" className="mt-2 text-[12px] text-red-400">{f.erro}</p>}
      <Button size="sm" icon="shield" className="mt-3 w-full" onClick={f.submit}>
        Gravar no cofre da box
      </Button>
    </div>
  );
}
