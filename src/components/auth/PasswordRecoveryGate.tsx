import { BrandMark, Button, Input } from '../primitives';
import { AuthIntro } from './AuthIntro';
import { AuthFeedback } from './AuthFeedback';
import { useNewPasswordForm } from './useNewPasswordForm';
import { MIN_PASSWORD } from '../../lib/password-rules';

interface Props {
  changePassword: (password: string) => Promise<string | null>;
  onDone: () => void;
  onCancel: () => void;
}

// Tela de definir senha nova depois de clicar no link de recuperação. O link já
// cria sessão válida no Supabase, então ela é um GATE: enquanto o usuário não
// trocar (ou cancelar), o app não aparece.
export function PasswordRecoveryGate({ changePassword, onDone, onCancel }: Props) {
  const f = useNewPasswordForm(changePassword, onDone);

  return (
    <div className="flex h-full flex-1 items-center justify-center gap-12 bg-neutral-950 px-4">
      <AuthIntro />
      <form onSubmit={f.submit} className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <BrandMark title="deck" subtitle="definir nova senha" className="mb-5" />
        <p className="mb-4 text-[11.5px] leading-relaxed text-neutral-500">
          Escolha a senha nova da sua conta. Mínimo de {MIN_PASSWORD} caracteres.
        </p>

        <label htmlFor="recovery-password" className="mb-1.5 block text-[11px] font-medium text-neutral-400">Nova senha</label>
        <Input
          id="recovery-password"
          type="password" value={f.password} onChange={(e) => f.setPassword(e.target.value)}
          autoComplete="new-password" autoFocus placeholder="••••••••" className="mb-3"
        />
        <label htmlFor="recovery-confirm" className="mb-1.5 block text-[11px] font-medium text-neutral-400">Confirme a senha</label>
        <Input
          id="recovery-confirm"
          type="password" value={f.confirm} onChange={(e) => f.setConfirm(e.target.value)}
          autoComplete="new-password" placeholder="••••••••"
        />

        <AuthFeedback error={f.error} />

        <Button type="submit" loading={f.busy} disabled={!f.password || !f.confirm} className="mt-4 w-full">
          {f.busy ? 'Salvando…' : 'Salvar senha'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="mt-3 w-full" onClick={onCancel}>
          Cancelar e voltar pro login
        </Button>
      </form>
    </div>
  );
}
