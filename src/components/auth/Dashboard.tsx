import { BrandMark, Button } from '../primitives';
import { usePairing } from './usePairing';
import { useAccountAdmin } from './useAccountAdmin';
import { PairingStatus } from './PairingStatus';
import { InstallModePicker } from './InstallModePicker';
import { PairCommand } from './PairCommand';
import { PairStep } from './PairStep';
import { InstallExplainer } from './InstallExplainer';
import { RelayVisibility } from './RelayVisibility';
import { BetaNote } from './BetaNote';
import { usePasskeySetup } from './usePasskeySetup';
import { SetupChecklistView } from '../health/SetupChecklistView';
import { startSetupWatch, useSetupChecklist } from '../health/useSetupChecklist';

// Dashboard de pareamento (DR-023): mostrado quando o usuário está logado mas a VPS
// dele ainda não está atendendo. Pede um código ao relay e mostra o comando de 1 linha
// pra rodar na VPS; quando o agente conecta, o App troca pro app de verdade.
export function Dashboard({ token, userId, onSignOut }: { token: string; userId?: string; onSignOut: () => void }) {
  const admin = useAccountAdmin(userId);
  const pk = usePasskeySetup();
  const p = usePairing(token, false, admin, '', pk.version);
  const setup = useSetupChecklist(true);

  return (
    <div className="flex h-full flex-1 justify-center overflow-y-auto bg-neutral-950 px-4 py-6">
      <div className="my-auto w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-2xl sm:p-7">
        <BrandMark title="conectar sua VPS" subtitle="rode um comando na sua máquina pra começar" bitState="connecting" />
        <p className="mb-6 mt-4 text-[13px] leading-relaxed text-neutral-400">
          O Deck é a tela; o cérebro roda na sua VPS. Escolha como instalar, cole o comando e a tela troca sozinha quando conectar.
        </p>

        <div className="space-y-6">
          <PairStep n={1} title="Como instalar">
            <InstallModePicker mode={p.mode} onChange={p.setMode} />
          </PairStep>
          <PairStep n={2} title="Cole na sua VPS">
            <PairCommand code={p.code} cmd={p.cmd} busy={p.busy} expired={p.expired} countdown={p.countdown} mode={p.mode} onCopy={() => startSetupWatch()} />
            {/* Um só lugar pro erro: com o código já na tela, a falha de "gerar novo código" não aparecia. */}
            <InstallExplainer mode={p.mode} />
            {p.err && <p className="mt-3 text-[12px] text-red-300">{p.err}</p>}
          </PairStep>
          <PairStep n={3} title="Aguarde a conexão">
            {setup.checklist && <div className="mb-3"><SetupChecklistView c={setup.checklist} /></div>}
            <PairingStatus diagnosis={p.diagnosis} probe={p.probe} onTest={p.testConnection} />
          </PairStep>
        </div>

        <RelayVisibility />
        <BetaNote />

        <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
          <Button variant="ghost" size="sm" onClick={p.fetchCode} disabled={p.busy} loading={p.busy}>
            {p.busy ? 'gerando…' : 'gerar novo código'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSignOut}>sair</Button>
        </div>
      </div>
    </div>
  );
}
