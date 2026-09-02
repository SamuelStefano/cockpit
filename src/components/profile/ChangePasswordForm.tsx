import { useState } from 'react';
import { Button, Input } from '../primitives';
import { useNewPasswordForm } from '../auth/useNewPasswordForm';

// Bloco "Trocar senha" do menu de perfil: fechado por padrão (o menu já é denso),
// abre um mini-formulário com confirmação. Some sozinho quando o Supabase está
// desligado — quem passa a prop é o App, e no loopback não existe conta.
export function ChangePasswordForm({ onSubmit }: { onSubmit: (password: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const f = useNewPasswordForm(onSubmit, () => setOpen(false));

  const toggle = () => { setOpen((o) => !o); f.reset(); };

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <Button variant="outline" size="sm" icon="shield" className="w-full" onClick={toggle}>
        {open ? 'Cancelar troca de senha' : 'Trocar senha'}
      </Button>

      {open && (
        <form onSubmit={f.submit} className="mt-2 space-y-2">
          <Input
            size="sm" type="password" value={f.password} onChange={(e) => f.setPassword(e.target.value)}
            autoComplete="new-password" placeholder="Nova senha" aria-label="Nova senha"
          />
          <Input
            size="sm" type="password" value={f.confirm} onChange={(e) => f.setConfirm(e.target.value)}
            autoComplete="new-password" placeholder="Confirme a senha" aria-label="Confirme a senha"
          />
          <Button type="submit" size="sm" loading={f.busy} disabled={!f.password || !f.confirm} className="w-full">
            {f.busy ? 'Salvando…' : 'Salvar senha'}
          </Button>
        </form>
      )}

      {f.error && <p role="alert" className="mt-1.5 text-[11px] text-red-400">{f.error}</p>}
      {f.done && !open && <p className="mt-1.5 text-[11px] text-emerald-400">Senha trocada.</p>}
    </div>
  );
}
