import { useState } from 'react';

export type AuthMode = 'login' | 'register' | 'forgot';

export interface AuthGateActions {
  error: string;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
}

// Estado do formulário do gate (login/criar conta/esqueci a senha). Fora do
// componente porque a tela é só JSX — e as três variantes compartilham email,
// busy e a faixa de feedback.
export function useAuthGateForm(auth: AuthGateActions) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const canSubmit = !!email.trim() && (mode === 'forgot' || !!password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    const addr = email.trim();
    setBusy(true);
    setInfo('');
    const ok =
      mode === 'login' ? await auth.signIn(addr, password)
      : mode === 'register' ? await auth.signUp(addr, password)
      : await auth.resetPassword(addr);
    setBusy(false);
    if (!ok) return;
    // "Se existir": o Supabase responde igual pra e-mail cadastrado ou não, e a
    // mensagem não pode denunciar quem tem conta aqui.
    if (mode === 'register') setInfo('Conta criada. Se pedir confirmação, cheque seu e-mail.');
    if (mode === 'forgot') setInfo('Se existir conta com esse e-mail, o link de recuperação já foi enviado. Cheque a caixa de entrada e o spam.');
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setPassword('');
    setInfo('');
    auth.clearError();
  };

  return { mode, email, setEmail, password, setPassword, busy, info, canSubmit, submit, switchMode };
}
