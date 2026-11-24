import { useCallback, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { emailConfirms, requestAccountDeletion } from '../../lib/accountDeletion';

// Drives the "Excluir conta" confirmation. The token and email are read from the
// live session at confirm time (supabase refreshes the JWT hourly).
export function useDeleteAccount(onSignOut: () => void | Promise<void>) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const show = useCallback(async () => {
    setTyped(''); setErr(''); setOpen(true);
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    setEmail(data.session?.user.email ?? '');
  }, []);
  const close = useCallback(() => { if (!busy) setOpen(false); }, [busy]);

  const canConfirm = !busy && emailConfirms(typed, email);

  const confirm = useCallback(async () => {
    if (!canConfirm) return;
    setBusy(true); setErr('');
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    const r = token ? await requestAccountDeletion(token) : { ok: false as const, message: 'Sua sessão expirou. Entre de novo e tente outra vez.' };
    setBusy(false);
    if (!r.ok) { setErr(r.message); return; }
    setOpen(false);
    await onSignOut();
  }, [canConfirm, onSignOut]);

  return { open, email, typed, setTyped, busy, err, canConfirm, show, close, confirm };
}
