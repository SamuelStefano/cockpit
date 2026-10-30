import { Segmented } from '../primitives';
import type { InstallTarget } from './useInstallTarget';

interface InstallTargetPickerProps {
  target: InstallTarget;
  onTarget: (t: InstallTarget) => void;
}

const mono = 'font-mono text-neutral-400';

const TARGETS = [
  { id: 'windows' as const, label: 'neste PC (Windows)' },
  { id: 'remote' as const, label: 'VPS remota' },
];

export function InstallTargetPicker({ target, onTarget }: InstallTargetPickerProps) {
  return (
    <div className="mb-3">
      <Segmented label="Onde instalar" items={TARGETS} value={target} onChange={onTarget} />
      {target === 'windows' && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-neutral-400">
          Não precisa de WSL nem Docker. Node, Git e Claude entram sozinhos se faltarem. Log em <span className={mono}>~\.deck-agent\agent.log</span>.
        </p>
      )}
    </div>
  );
}
