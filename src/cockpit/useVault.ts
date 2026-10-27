import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg, VaultItem } from '../../shared/protocol';

export type VaultApi = Omit<Vault, 'onMsg'>;

export interface Vault {
  vault: VaultItem[];
  vaultLoaded: boolean;
  onVaultList: () => void;
  onVaultPut: (name: string, value: string, agents: string[]) => boolean;
  onVaultRm: (name: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

export function useVault(send: (m: ClientMsg) => boolean): Vault {
  const [vault, setVault] = useState<VaultItem[]>([]);
  const [vaultLoaded, setVaultLoaded] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'vault') return false;
    setVault(msg.items);
    setVaultLoaded(true);
    return true;
  }, []);

  return {
    vault,
    vaultLoaded,
    onVaultList: useCallback(() => { send({ t: 'vault-list' }); }, [send]),
    onVaultPut: useCallback((name: string, value: string, agents: string[]) => send({ t: 'vault-put', name, value, agents }), [send]),
    onVaultRm: useCallback((name: string) => { send({ t: 'vault-rm', name }); }, [send]),
    onMsg,
  };
}
