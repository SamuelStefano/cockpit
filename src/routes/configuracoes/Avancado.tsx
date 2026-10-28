import { Button, ListRow, SectionTitle } from '../../components/primitives';
import { AdminConfirm } from '../AdminConfirm';
import { useDeckUpdate } from '../useDeckUpdate';
import type { Caps } from '../../../shared/protocol';
import { SwitchRow } from './SwitchRow';
import { useAdminOpToast } from './useAdminOpToast';

interface AvancadoProps {
  caps: Caps | null | undefined;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  isRoot: boolean;
  isMobile: boolean;
  adminOp: { ok: boolean; message: string } | null;
  onCliUpdate: () => void;
  onDeckRestart: (mode: 'idle' | 'now') => void;
  onOpenTerminal: () => void;
}

export function Avancado({ caps, bypass, setBypass, isRoot, isMobile, adminOp, onCliUpdate, onDeckRestart, onOpenTerminal }: AvancadoProps) {
  useAdminOpToast(adminOp);
  const u = useDeckUpdate(adminOp, onCliUpdate, onDeckRestart);
  return (
    <>
      <SectionTitle>Avançado</SectionTitle>
      <div className="overflow-hidden rounded-xl border border-red-500/25 bg-neutral-900/60 hairline">
        {caps?.canBypass && (
          <SwitchRow
            danger label="Pular aprovações" checked={bypass} onChange={() => setBypass(!bypass)}
            hint="O agente roda qualquer comando sem perguntar. Só nesta máquina e só pra administradores."
          />
        )}
        {!isMobile && (
          <ListRow
            label="Terminal" hint="Abre um terminal da máquina dentro do Deck"
            trailing={<Button variant="ghost" size="sm" icon="terminal" onClick={onOpenTerminal}>Abrir</Button>}
          />
        )}
        {isRoot && (
          <ListRow
            label="Reiniciar o Deck"
            trailing={<Button variant="danger" size="sm" loading={u.busy === 'restart'} disabled={u.busy !== null} onClick={u.askRestartNow}>Reiniciar</Button>}
          />
        )}
      </div>
      {u.confirmNow && (
        <AdminConfirm
          heading="Reiniciar o Deck agora?" icon="zap" tone="danger" cta="Reiniciar"
          body="Backend e agente caem por alguns segundos e todas as abas reconectam. Turnos em voo são interrompidos e retomados no boot."
          onConfirm={u.restartNow} onCancel={u.cancelRestartNow}
        />
      )}
    </>
  );
}
