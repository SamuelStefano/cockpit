import { useState } from 'react';
import { Icon } from '../../components/primitives';

interface DeviceCodeProps { command: string }

export function DeviceCode({ command }: DeviceCodeProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(command).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <>
      <p className="text-[13px] leading-relaxed text-neutral-400">
        1. Abra o terminal desta máquina &nbsp;2. Rode o comando abaixo &nbsp;3. Volte aqui — o Deck percebe sozinho.
      </p>
      <div className="flex items-center gap-2.5 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 font-mono text-[13px] text-neutral-200">
        <b className="min-w-0 break-all font-semibold text-neutral-100">{command}</b>
        <button
          type="button" onClick={copy} aria-label="Copiar"
          className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>
      </div>
    </>
  );
}
