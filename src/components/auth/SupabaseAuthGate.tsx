import { BrandMark, Button, Input } from '../primitives';
import { AuthIntro } from './AuthIntro';
import { AuthFeedback } from './AuthFeedback';
import { AuthModeTabs } from './AuthModeTabs';
import { useAuthGateForm, type AuthGateActions } from './useAuthGateForm';

const SUBTITLE = {
  login: 'entrar na sua conta',
  register: 'criar conta',
  forgot: 'recuperar acesso',
} as const;

const CTA = {
  login: ['Entrar', 'Entrando…'],
  register: ['Criar conta', 'Criando conta…'],
  forgot: ['Enviar link', 'Enviando…'],
} as const;

// Tela de login/registro/recuperação do produto multi-conta (DR-023). Mesmo molde
// visual do AuthGate de token (card escuro + laranja), mas com e-mail/senha via
// Supabase. Presentacional: recebe as ações do useSupabaseAuth. Só aparece quando o
// Supabase está ligado e não há sessão (App decide); no loopback nunca monta.
export function SupabaseAuthGate({ auth }: { auth: AuthGateActions }) {
  const { mode, email, setEmail, password, setPassword, busy, info, canSubmit, submit, switchMode } = useAuthGateForm(auth);
  const [label, busyLabel] = CTA[mode];

  return (
    <div className="flex h-full flex-1 items-center justify-center gap-12 bg-neutral-950 px-4">
      <AuthIntro />
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <BrandMark title="deck" subtitle={SUBTITLE[mode]} className="mb-5" />

        {mode === 'forgot' ? (
          <p className="mb-4 text-[11.5px] leading-relaxed text-neutral-500">
            Informe o e-mail da conta. Mandamos um link pra você definir uma senha nova.
          </p>
        ) : (
          <AuthModeTabs mode={mode} onSelect={switchMode} />
        )}

        <label htmlFor="auth-email" className="mb-1.5 block text-[11px] font-medium text-neutral-400">E-mail</label>
        <Input
          id="auth-email"
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" inputMode="email" autoFocus placeholder="voce@exemplo.com"
          className="mb-3"
        />
        {mode !== 'forgot' && (
          <>
            <label htmlFor="auth-password" className="mb-1.5 block text-[11px] font-medium text-neutral-400">Senha</label>
            <Input
              id="auth-password"
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••"
            />
          </>
        )}

        <AuthFeedback error={auth.error} info={info} />

        <Button type="submit" loading={busy} disabled={!canSubmit} className="mt-4 w-full">
          {busy ? busyLabel : label}
        </Button>

        {mode === 'login' && (
          <button type="button" onClick={() => switchMode('forgot')} className="mt-3 text-[11px] text-neutral-500 transition hover:text-orange-300">
            Esqueci a senha
          </button>
        )}
        {mode === 'forgot' && (
          <Button type="button" variant="ghost" size="sm" icon="chevronLeft" className="mt-3 w-full" onClick={() => switchMode('login')}>
            Voltar pro login
          </Button>
        )}
        {mode !== 'forgot' && (
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
            Depois de entrar, conecte sua VPS pra começar a usar o Deck na sua máquina.
          </p>
        )}
      </form>
    </div>
  );
}
