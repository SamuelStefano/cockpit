import { Icon } from '../primitives';
import { ClaudeAvatar } from '../Avatar';

interface ChatEmptyProps {
  onPrompt: (text: string) => void;
}

export function ChatEmpty({ onPrompt }: ChatEmptyProps) {
  const examples = [
    'Por que meu git push deu "rejected"?',
    'Configurar deploy com webhook na VPS',
    'O psql travou num lock — como destravo?',
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4">
        <ClaudeAvatar size={48} />
      </div>
      <h2 className="text-[17px] font-semibold text-neutral-200">Em que vamos trabalhar?</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">
        Converse com o agente e ele pode rodar comandos nos seus terminais da VPS.
      </p>
      <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
        {examples.map((e) => (
          <button key={e} onClick={() => onPrompt(e)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-left text-[12.5px] text-neutral-400 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40">
            <span>{e}</span>
            <Icon name="arrowUp" size={13} className="rotate-90 text-neutral-600 transition group-hover:text-orange-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
