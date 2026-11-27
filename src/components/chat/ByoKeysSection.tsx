import { useEffect } from 'react';
import { BYO_PROVIDERS } from '../../../shared/byo-providers';
import type { AgentsApi } from '../../cockpit/useAgents';
import { ByoKeyRow } from './ByoKeyRow';

export function ByoKeysSection({ agents }: { agents: Required<Pick<AgentsApi, 'byoKeys' | 'byoMessage' | 'saveByoKey' | 'removeByoKey' | 'refreshByoKeys'>> }) {
  const { byoKeys, byoMessage, saveByoKey, removeByoKey, refreshByoKeys } = agents;
  useEffect(() => { refreshByoKeys(); }, [refreshByoKeys]);
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold text-neutral-100">Usar sua própria chave de API</p>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
        A chave fica guardada só nesta VPS e nunca volta pro navegador. Depois de salvar, os modelos aparecem no seletor.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {BYO_PROVIDERS.map((p) => (
          <ByoKeyRow
            key={p.id} provider={p} view={byoKeys.find((v) => v.provider === p.id)}
            onSave={(key) => saveByoKey(p.id, key)} onRemove={() => removeByoKey(p.id)}
          />
        ))}
      </div>
      {byoMessage && <p role="status" className={`mt-2 text-[12px] ${byoMessage.ok ? 'text-green-400' : 'text-red-400'}`}>{byoMessage.message}</p>}
    </div>
  );
}
