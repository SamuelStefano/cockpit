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
  if (c === 'same_password' || m.includes('should be different')) return 'A nova senha precisa ser diferente da atual.';
  if (c === 'otp_expired' || m.includes('link is invalid') || m.includes('has expired')) return 'Link de recuperação expirado. Peça outro.';
  if (c === 'session_not_found' || m.includes('auth session missing')) return 'Sessão expirada. Entre de novo.';
  if (c.includes('rate') || m.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco.';
  if (m.includes('email') && m.includes('valid')) return 'E-mail inválido.';
  return err.message ?? 'Algo deu errado. Tente de novo.';
}

// O link do e-mail volta pra `/?reset=1`. É sinal redundante ao evento
// PASSWORD_RECOVERY: a detecção da URL roda no init do cliente Supabase, que pode
// terminar antes deste hook assinar o onAuthStateChange — sem a query o usuário
// entraria direto no app com o link de recuperação, sem trocar senha nenhuma.
export function recoveryFromUrl(search: string): boolean {
  try {
    return new URLSearchParams(search).get('reset') === '1';
  } catch {
    return false;
  }
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<string | null>;
  endRecovery: () => void;
  clearError: () => void;
}

// Hook de auth do produto multi-conta. Mantém a sessão, expõe as ações, e dispara
// onToken(access_token | null) em todo SIGNED_IN/TOKEN_REFRESHED/SIGNED_OUT — o App
// repassa esse token pro WS reconectar (refresh silencioso, sem reload).
export function useSupabaseAuth(onToken: (token: string | null) => void): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(() => recoveryFromUrl(globalThis.location?.search ?? ''));
  const recoveryRef = useRef(recovery);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (evt === 'PASSWORD_RECOVERY') { recoveryRef.current = true; setRecovery(true); }
      setSession(sess);
      // Em recuperação o token NÃO vai pro WS: o link do e-mail já vale como sessão,
      // e conectar a box antes da senha nova daria o agente inteiro pra quem só teve
      // acesso à caixa de entrada. Volta a fluir no endRecovery.
      onTokenRef.current(recoveryRef.current ? null : (sess?.access_token ?? null));
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

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return false;
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${globalThis.location.origin}/?reset=1`,
    });
    if (error) { setError(friendlyAuthError(error)); return false; }
    return true;
  }, []);

  // Canal de erro PRÓPRIO (retorna a mensagem em vez de escrever no `error` do
  // hook): a troca de senha acontece no menu de perfil, longe do gate de login, e
  // um erro daqui não pode pintar a tela de entrar.
  const changePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    if (!supabase) return 'Conta indisponível neste modo.';
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? friendlyAuthError(error) : null;
  }, []);

  // Some com o ?reset=1 junto: deixá-lo na barra prenderia o usuário na tela de
  // nova senha em todo refresh depois de já ter trocado.
  const endRecovery = useCallback(() => {
    recoveryRef.current = false;
    setRecovery(false);
    if (recoveryFromUrl(globalThis.location?.search ?? '')) {
      globalThis.history?.replaceState(null, '', globalThis.location.pathname);
    }
    // Solta pro WS o token que ficou retido durante a recuperação (ou null, se o
    // usuário desistiu e saiu) — senão o app abriria sem conexão até um F5.
    void supabase?.auth.getSession().then(({ data }) => onTokenRef.current(data.session?.access_token ?? null));
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return { session, loading, error, recovery, signIn, signUp, signOut, resetPassword, changePassword, endRecovery, clearError };
}
