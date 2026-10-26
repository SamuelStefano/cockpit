import { Segmented } from '../primitives';
import type { InstallMode } from './pairing';

const ITEMS: { id: InstallMode; label: string }[] = [
  { id: 'isolated', label: 'isolado (recomendado)' },
  { id: 'dedicated', label: 'VPS dedicada' },
];

const mono = 'font-mono text-neutral-300';

export function InstallModePicker({ mode, onChange }: { mode: InstallMode; onChange: (m: InstallMode) => void }) {
  return (
    <div className="mb-3">
      <Segmented label="modo de instalação" items={ITEMS} value={mode} onChange={onChange} />
      <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
        {mode === 'isolated' ? (
          <>Roda num usuário <span className={mono}>deck</span> separado, sem sudo. Não mexe na sua conta, no seu Node nem nos seus pacotes. Pede sua senha de sudo só pra criar o usuário e o serviço.</>
        ) : (
          <>Pra VPS só do Deck. Instala no seu usuário; pra controle total (terminais e admin) use <span className={mono}>DECK_AGENT_ROLE=admin</span>.</>
        )}{' '}
        Pra só ver o plano sem instalar, use <span className={mono}>DECK_DRY_RUN=1</span>.
      </p>
    </div>
  );
}
