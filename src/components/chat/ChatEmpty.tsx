import { Icon, type IconName } from '../primitives';
import { ClaudeAvatar } from '../ClaudeAvatar';

interface ChatEmptyProps {
  onPrompt: (text: string) => void;
}

// Grid de tópicos estilo ChatGPT: cards categorizados com ícone, em vez de lista
// crua. Cada card envia o prompt direto — a categoria dá o "cheiro" do que o
// agente sabe fazer nesta VPS (terminal, deploy, debug, análise).
const TOPICS: { icon: IconName; label: string; prompt: string }[] = [
  { icon: 'terminal', label: 'Terminal', prompt: 'Mostra o estado da VPS: disco, memória, processos pesados' },
  { icon: 'zap', label: 'Deploy', prompt: 'Configurar deploy com webhook na VPS' },
  { icon: 'search', label: 'Debug', prompt: 'O psql travou num lock — como destravo?' },
  { icon: 'sparkles', label: 'Análise', prompt: 'Analisa os logs recentes e resume o que aconteceu' },
];

export function ChatEmpty({ onPrompt }: ChatEmptyProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4">
        <ClaudeAvatar size={48} />
      </div>
      <h2 className="text-[19px] font-semibold text-neutral-200">Em que vamos trabalhar?</h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">
        Converse com o agente e ele pode rodar comandos nos seus terminais da VPS.
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <button
            key={t.label}
            onClick={() => onPrompt(t.prompt)}
            className="group flex flex-col gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-left transition hover:border-neutral-700 hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-600 transition group-hover:text-orange-400">
              <Icon name={t.icon} size={12} /> {t.label}
            </span>
            <span className="text-[12.5px] leading-snug text-neutral-400 transition group-hover:text-neutral-200">{t.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
