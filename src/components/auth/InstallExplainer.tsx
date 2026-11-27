import { Icon } from '../primitives';
import { COMMAND_DOES, COMMAND_DOES_NOT, DRY_RUN_ENV, SETUP_SOURCE_URL } from './install-facts';
import type { InstallMode } from './pairing';

const mono = 'font-mono text-neutral-400';

const MODE_NOTE: Record<InstallMode, string> = {
  isolated: 'Isolado: cria o usuário deck (sem sudo) e instala tudo no HOME dele. Sua conta e seus pacotes ficam intactos; o sudo só registra o serviço.',
  dedicated: 'Seu usuário: instala no seu HOME e roda com as permissões da sua conta. Use numa VPS só do Deck.',
};

export function InstallExplainer({ mode }: { mode: InstallMode }) {
  return (
    <details className="group mt-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 text-[12px] leading-relaxed text-neutral-400" open>
      <summary className="cursor-pointer list-none text-[13px] font-medium text-neutral-200">
        <Icon name="shield" size={12} className="mr-1.5 inline text-orange-400" />
        O que este comando faz
      </summary>
      <p className="mt-2 text-neutral-500">{MODE_NOTE[mode]}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {COMMAND_DOES.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="mt-2.5 font-medium text-neutral-300">O que ele não faz</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {COMMAND_DOES_NOT.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <p className="mt-2.5">
        Ver antes de rodar: troque <span className={mono}>DECK_PAIR_CODE=…</span> por <span className={mono}>{DRY_RUN_ENV}</span> e ele só imprime o plano.
        Ou{' '}
        <a href={SETUP_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline underline-offset-2 hover:text-orange-200">leia o código do script no GitHub</a>.
      </p>
    </details>
  );
}
