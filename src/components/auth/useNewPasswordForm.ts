import { useState } from 'react';
import { newPasswordError } from '../../lib/password-rules';

// Estado dos dois formulários de "definir senha nova" (recuperação e perfil).
// `submit` devolve a mensagem de erro do Supabase (ou null), então quem chama
// decide o que fazer no sucesso — sair da tela, fechar o menu, etc.
export function useNewPasswordForm(onSubmit: (password: string) => Promise<string | null>, onDone?: () => void) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const invalid = newPasswordError(password, confirm);
    if (invalid) { setError(invalid); setDone(false); return; }
    setBusy(true);
    setError('');
    setDone(false);
    const failed = await onSubmit(password);
    setBusy(false);
    if (failed) { setError(failed); return; }
    setPassword('');
    setConfirm('');
    setDone(true);
    onDone?.();
  };

  const reset = () => { setPassword(''); setConfirm(''); setError(''); setDone(false); };

  return { password, setPassword, confirm, setConfirm, busy, error, done, submit, reset };
}
