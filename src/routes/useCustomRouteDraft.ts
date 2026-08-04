import { useCallback, useState } from 'react';
import { validateCustom, type CustomDraft } from './admin-routes';
import type { ClientMsg } from '../../shared/protocol';

export type CustomRouteAdd = (r: Omit<Extract<ClientMsg, { t: 'route-custom-add' }>, 't'>) => void;

const EMPTY: CustomDraft = { id: '', baseUrl: '', model: '', authEnv: '' };

export interface CustomRouteDraft {
  draft: CustomDraft;
  error: string | null;
  set: (k: keyof CustomDraft) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  submit: () => void;
}

export function useCustomRouteDraft(onAdd: CustomRouteAdd): CustomRouteDraft {
  const [draft, setDraft] = useState<CustomDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(() => {
    const problem = validateCustom(draft);
    setError(problem);
    if (problem) return;
    onAdd({
      id: draft.id.trim(),
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      authEnv: draft.authEnv.trim() || undefined,
    });
    setDraft(EMPTY);
  }, [draft, onAdd]);

  // Digitar limpa o erro: o texto antigo apontava pra um campo que o usuário já
  // está corrigindo, e mantê-lo faria a linha vermelha parecer travada.
  const set = useCallback(
    (k: keyof CustomDraft) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft((d) => ({ ...d, [k]: e.target.value }));
      setError(null);
    },
    [],
  );

  return { draft, error, set, submit };
}
