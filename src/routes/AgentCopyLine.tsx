import { Button } from '../components/primitives';
import { useCopied } from '../lib/useCopied';

export function AgentCopyLine({ command }: { command: string }) {
  const [copied, copy, failed] = useCopied(1500);
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-neutral-200">{command}</code>
      <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} onClick={() => copy(command)} aria-label={`Copiar comando: ${command}`}>
        {copied ? 'Copiado' : failed ? 'Falhou' : 'Copiar'}
      </Button>
    </div>
  );
}
