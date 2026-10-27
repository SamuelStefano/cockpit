import { Button } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import { sshInstallCommand } from './ssh-install';

const mono = 'font-mono text-neutral-400';

export function SshInstallHint({ code }: { code: string }) {
  const [copied, copy, copyFailed] = useCopied();
  const cmd = sshInstallCommand(code);
  if (!cmd) return null;
  return (
    <div className="rounded-xl border border-neutral-800 p-3.5">
      <p className="text-[12.5px] leading-relaxed text-neutral-400">
        Tem só o acesso SSH? Rode no <b>seu computador</b> (sua chave não sai dele). Troque <span className={mono}>user@host</span> pelo seu servidor; no primeiro acesso confirme a impressão digital do host.
      </p>
      <code className="mt-2 block break-all font-mono text-[12.5px] leading-relaxed text-orange-200">{cmd}</code>
      <div className="mt-2 flex justify-end">
        <Button size="sm" icon={copied ? 'check' : 'copy'} onClick={() => copy(cmd)}>
          {copied ? 'copiado ✓' : copyFailed ? 'falhou — copie à mão' : 'copiar'}
        </Button>
      </div>
    </div>
  );
}
