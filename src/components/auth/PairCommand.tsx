import { Badge, Button } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import { windowsSetupFile, type InstallMode } from './pairing';
import { InstallTargetPicker } from './InstallTargetPicker';
import type { useInstallTarget } from './useInstallTarget';

interface PairCommandProps {
  code: string;
  cmd: string;
  windowsCmd: string;
  busy: boolean;
  expired: boolean;
  countdown: string | null;
  mode: InstallMode;
  onCopy?: () => void;
  target: ReturnType<typeof useInstallTarget>;
}

const mono = 'font-mono text-neutral-400';

function downloadInstaller(command: string) {
  const url = URL.createObjectURL(new Blob([windowsSetupFile(command)], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Instalar Deck.cmd';
  a.click();
  URL.revokeObjectURL(url);
}

export function PairCommand({ code, cmd: remoteCmd, windowsCmd, busy, expired, countdown, mode, onCopy, target }: PairCommandProps) {
  const [copied, copy, copyFailed] = useCopied();
  const cmd = target.native ? windowsCmd : remoteCmd;
  const box = (
    <>
      <div className={`rounded-xl border bg-neutral-950 p-3.5 ${expired ? 'border-yellow-500/40' : 'border-neutral-800'}`}>
        {code ? (
          <code className={`block break-all font-mono text-[13px] leading-relaxed ${expired ? 'text-neutral-600 line-through' : 'text-orange-200'}`}>{cmd}</code>
        ) : (
          <div className="text-[13px] text-neutral-500">{busy ? 'gerando código…' : '—'}</div>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* O código morre em minutos no relay; sem a contagem o usuário colava um comando morto. */}
        {countdown !== null ? (
          <Badge tone={expired ? 'red' : 'neutral'} dot>
            {expired ? 'código expirado' : `válido por ${countdown}`}
          </Badge>
        ) : <span />}
        <Button size="md" icon={copied ? 'check' : 'copy'} disabled={expired || !code} onClick={() => { copy(cmd); onCopy?.(); }}>
          {copied ? 'copiado ✓' : copyFailed ? 'falhou — copie à mão' : 'copiar'}
        </Button>
      </div>
      {mode === 'dedicated' && !target.native && (
        <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
          Pra controle total (terminais e admin), use <span className={mono}>DECK_AGENT_ROLE=admin</span>.
        </p>
      )}
    </>
  );
  return (
    <div>
      {target.isWindows && <InstallTargetPicker target={target.target} onTarget={target.setTarget} />}
      {target.native ? (
        <>
          <Button size="md" icon="download" disabled={expired || !code} onClick={() => { downloadInstaller(cmd); onCopy?.(); }}>
            {expired ? 'código expirado' : 'Baixar instalador'}
          </Button>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-neutral-400">
            <li>Abra o arquivo baixado.</li>
            <li>Se o Windows avisar, clique em <b>Mais informações</b> e <b>Executar assim mesmo</b>.</li>
            <li>Espere. Esta tela troca sozinha quando conectar.</li>
          </ol>
          {countdown !== null && !expired && <p className="mt-2 text-[12px] text-neutral-500">Vale por {countdown}.</p>}
          <details className="mt-3 text-[12px] text-neutral-500">
            <summary className="cursor-pointer">Prefiro colar um comando</summary>
            <div className="mt-2">{box}</div>
          </details>
        </>
      ) : box}
    </div>
  );
}
