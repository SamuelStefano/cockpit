import { VaultForm } from './VaultForm';
import { VaultList } from './VaultList';
import type { VaultApi } from '../../cockpit/useVault';

export function VaultPanel({ api }: { api: VaultApi }) {
  return (
    <section aria-label="Cofre da box" className="mt-5 grid gap-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 md:grid-cols-2">
      <div>
        <h2 className="text-[14px] font-semibold text-neutral-100">Cofre da box</h2>
        <p className="mb-3 mt-1 text-[13px] leading-relaxed text-neutral-400">
          Segredos ficam criptografados só nesta box e viram variáveis de ambiente quando o agente
          da lista inicia. O valor nunca volta pra tela: só dá pra gravar de novo ou remover.
          Mudanças valem a partir da próxima sessão do agente.
        </p>
        <VaultForm api={api} open />
      </div>
      <div>
        <h3 className="text-[12px] font-medium text-neutral-500">Na box</h3>
        <VaultList items={api.vault} onRemove={api.onVaultRm} />
      </div>
    </section>
  );
}
