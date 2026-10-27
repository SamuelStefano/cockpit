import { Segmented } from '../primitives';
import type { WslTarget } from './useWslGuide';

interface WslStepsProps {
  target: WslTarget;
  onTarget: (t: WslTarget) => void;
  showSteps: boolean;
}

const mono = 'font-mono text-neutral-400';

const TARGETS = [
  { id: 'wsl' as const, label: 'neste PC (WSL)' },
  { id: 'remote' as const, label: 'VPS remota' },
];

export function WslSteps({ target, onTarget, showSteps }: WslStepsProps) {
  return (
    <div className="mb-3">
      <Segmented label="Onde instalar" items={TARGETS} value={target} onChange={onTarget} />
      {showSteps && (
        <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[12px] leading-relaxed text-neutral-400">
          <li>
            Abra o terminal do Ubuntu (WSL): no Prompt de Comando digite <span className={mono}>wsl</span> e Enter. Sem WSL, rode no PowerShell como administrador <span className={mono}>wsl --install</span> e reinicie o PC.
          </li>
          <li>Cole o comando abaixo.</li>
        </ol>
      )}
    </div>
  );
}
