import { useState } from 'react';
import { Button, Input } from '../primitives';
import { loadPref } from '../../lib/persist';
import { usePairing } from '../auth/usePairing';
import { useAccountAdmin } from '../auth/useAccountAdmin';
import { InstallModePicker } from '../auth/InstallModePicker';
import { PairCommand } from '../auth/PairCommand';
import { SetupChecklistView } from '../health/SetupChecklistView';
import { startSetupWatch, useSetupChecklist } from '../health/useSetupChecklist';
import { SshInstallHint } from '../auth/SshInstallHint';
import { sshOnboardingEnabled } from '../auth/ssh-install';

// Same code + install command as the first-machine Dashboard, for one more box.
export function BoxPairing({ userId }: { userId?: string }) {
  const [label, setLabel] = useState('');
  const p = usePairing(loadPref<string>('auth.token', ''), false, useAccountAdmin(userId), label);
  const setup = useSetupChecklist(true);
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-neutral-400">
        Rode o comando na outra máquina. Ela aparece aqui sozinha quando conectar, sem derrubar as que já estão online.
      </p>
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da máquina (opcional)" aria-label="Nome da máquina" maxLength={64} />
      <InstallModePicker mode={p.mode} onChange={p.setMode} />
      <PairCommand code={p.code} cmd={p.cmd} windowsCmd={p.windowsCmd} busy={p.busy} expired={p.expired} countdown={p.countdown} mode={p.mode} onCopy={() => startSetupWatch(label)} />
      {setup.checklist && <SetupChecklistView c={setup.checklist} onSwitch={setup.switchTo} onDismiss={setup.dismiss} />}
      {sshOnboardingEnabled() && !p.expired && <SshInstallHint code={p.code} />}
      {p.err && <p role="alert" className="text-[11.5px] text-red-300">{p.err}</p>}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={p.fetchCode} disabled={p.busy} loading={p.busy}>
          {p.busy ? 'gerando…' : 'gerar novo código'}
        </Button>
      </div>
    </div>
  );
}
