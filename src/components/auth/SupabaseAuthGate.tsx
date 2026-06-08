import { useState } from 'react';
import { Icon } from '../primitives';
import { AuthIntro } from './AuthIntro';

interface AuthActions {
  error: string;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  clearError: () => void;
}

// Tela de login/registro do produto multi-conta (DR-023). Mesmo molde visual do
// AuthGate de token (card escuro + laranja), mas com e-mail/senha via Supabase.
// Presentacional: recebe as ações do useSupabaseAuth. Só aparece quando o Supabase
// está ligado e não há sessão (App decide); no loopback nunca monta.
export function SupabaseAuthGate({ auth }: { auth: AuthActions }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true); setInfo('');
    const ok = mode === 'login' ? await auth.signIn(email.trim(), password) : await auth.signUp(email.trim(), password);
    setBusy(false);
    if (ok && mode === 'register') setInfo('Conta criada. Se pedir confirmação, cheque seu e-mail.');
  };

  const switchMode = (m: 'login' | 'register') => { setMode(m); auth.clearError(); setInfo(''); };

  return (
    <div className="flex h-full flex-1 items-center justify-center gap-12 bg-neutral-950 px-4">
      <AuthIntro />
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
            <Icon name="terminal" size={16} stroke={2.4} />
          </span>
          <div>
            <div className="font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">deck</div>
            <div className="text-[11px] text-neutral-500">{mode === 'login' ? 'entrar na sua conta' : 'criar conta'}</div>
          </div>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-neutral-950 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition
                ${mode === m ? 'bg-orange-500/15 text-orange-300' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        <label className="mb-1.5 block text-[11px] font-medium text-neutral-400">E-mail</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" inputMode="email" autoFocus placeholder="voce@dfl.com"
          className="mb-3 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-none transition focus:border-orange-500/40"
        />
        <label className="mb-1.5 block text-[11px] font-medium text-neutral-400">Senha</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-200 outline-none transition focus:border-orange-500/40"
        />

        {auth.error && <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/[0.12] px-3 py-2 text-[11.5px] text-red-200">{auth.error}</p>}
        {info && <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/[0.1] px-3 py-2 text-[11.5px] text-emerald-200">{info}</p>}

        <button
          type="submit" disabled={busy || !email.trim() || !password}
          className="mt-4 w-full rounded-lg bg-orange-500 px-3 py-2 text-[13px] font-medium text-neutral-950 transition hover:bg-orange-400 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-neutral-600">
          Depois de entrar, conecte sua VPS pra começar a usar o Deck na sua máquina.
        </p>
      </form>
    </div>
  );
}
