import { relayHttpBase } from '../cockpit/session';

export type DeletionResult = { ok: true } | { ok: false; message: string };

const TIMEOUT_MS = 30_000;

// The relay checks the JWT, refuses owner accounts and deletes server-side with
// the service key. Safe to repeat: an already-deleted account answers 200.
export async function requestAccountDeletion(token: string, fetchImpl: typeof fetch = fetch): Promise<DeletionResult> {
  try {
    const res = await fetchImpl(`${relayHttpBase()}/account/delete`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: 'Sua sessão expirou. Entre de novo e tente outra vez.' };
    if (res.status === 403) return { ok: false, message: 'Contas de dono não podem ser excluídas por aqui.' };
    if (res.status === 429) return { ok: false, message: 'Muitas tentativas. Espere um minuto e tente de novo.' };
    return { ok: false, message: 'Não foi possível excluir a conta agora. Tente de novo em instantes.' };
  } catch {
    return { ok: false, message: 'Não deu pra falar com o servidor. Verifique sua conexão e tente de novo.' };
  }
}

export function emailConfirms(typed: string, email: string): boolean {
  const want = email.trim().toLowerCase();
  return want !== '' && typed.trim().toLowerCase() === want;
}
