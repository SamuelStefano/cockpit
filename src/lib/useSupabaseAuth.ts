import { useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Traduz o erro do Supabase pra uma mensagem curta em pt-BR. Pura/testável: casa
// pelo `code` (novo) ou pela substring da mensagem (fallback). Default genérico.
export function friendlyAuthError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return '';
  const c = err.code ?? '';
  const m = (err.message ?? '').toLowerCase();
  if (c === 'invalid_credentials' || m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (c === 'user_already_exists' || m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já está em uso.';
  if (c === 'weak_password' || m.includes('weak password') || m.includes('at least 6')) return 'Senha muito fraca (mín. 6 caracteres).';
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (c.includes('rate') || m.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco.';
  if (m.includes('email') && m.includes('valid')) return 'E-mail inválido.';
  return err.message ?? 'Algo deu errado. Tente de novo.';
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

// Hook de auth do produto multi-conta. Mantém a sessão, expõe as ações, e dispara
// onToken(access_token | null) em todo SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT — o App
// repassa esse token pro WS reconectar (refresh silencioso, sem reload).
export function useSupabaseAuth(onToken: (token: string | null) => void): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      onTokenRef.current(sess?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return false;
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(friendlyAuthError(error)); return false; }
    return true;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return false;
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(friendlyAuthError(error)); return false; }
    return true;
  }, []);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!supabase) return false;
    setError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setError(friendlyAuthError(error)); return false; }
    return true;
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return { session, loading, error, signIn, signUp, signOut, changePassword, clearError };
}
