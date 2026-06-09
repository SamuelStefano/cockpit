import { SUPABASE_ENABLED } from '../lib/supabase';
import type { useSupabaseAuth } from '../lib/useSupabaseAuth';
import { SupabaseAuthGate } from '../components/auth/SupabaseAuthGate';
import { Dashboard } from '../components/auth/Dashboard';
import { AuthGate } from '../components/chrome/AuthGate';

interface AuthGateViewProps {
  sbAuth: ReturnType<typeof useSupabaseAuth>;
  ejectPairing: boolean;
  authRequired: boolean;
  submitToken: (token: string) => void;
}

// Decide o gate de auth. Com Supabase ligado (relay): login por e-mail/senha; sem
// sessão, nada do app aparece. Logado mas a VPS ainda não atende → dashboard de
// pareamento. Sem Supabase (loopback): o gate de token de sempre (DR-011 Fase 2),
// quando o servidor exige token e o nosso falta/errou. Retorna null = app livre.
export function resolveAuthGate({ sbAuth, ejectPairing, authRequired, submitToken }: AuthGateViewProps) {
  let node: React.ReactNode = null;
  if (SUPABASE_ENABLED) {
    if (!sbAuth.loading && !sbAuth.session) node = <SupabaseAuthGate auth={sbAuth} />;
    else if (sbAuth.session && ejectPairing) node = <Dashboard token={sbAuth.session.access_token} onSignOut={sbAuth.signOut} />;
  } else if (authRequired) {
    node = <AuthGate onSubmit={submitToken} />;
  }
  if (!node) return null;
  return (
    <div
      className="flex h-full flex-col bg-neutral-950"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {node}
    </div>
  );
}
