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
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Halo quente atrás do avatar dá atmosfera — sem isto o vazio ficava chapado. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.07] blur-3xl" />
      <div className="fade-up relative mb-5">
        <div aria-hidden className="absolute inset-0 -z-10 rounded-full bg-orange-500/20 blur-xl" />
        <ClaudeAvatar size={52} />
      </div>
      <h2 className="fade-up text-[22px] font-semibold tracking-tight text-neutral-100">Em que vamos trabalhar?</h2>
      <p className="fade-up mt-2 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">
        Converse com o agente — ele roda comandos direto nos seus terminais da VPS.
      </p>
      <div className="stagger-fade mt-7 grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <button
            key={t.label}
            onClick={() => onPrompt(t.prompt)}
            className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-orange-500/40 hover:bg-neutral-900 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-600 transition group-hover:text-orange-400">
                <Icon name={t.icon} size={12} /> {t.label}
              </span>
              <Icon name="arrowUp" size={13} className="translate-x-1 rotate-45 text-orange-400/0 transition group-hover:translate-x-0 group-hover:text-orange-400/80" />
            </span>
            <span className="text-[13px] leading-snug text-neutral-400 transition group-hover:text-neutral-200">{t.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
