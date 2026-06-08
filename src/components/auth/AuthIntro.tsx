import { Icon } from '../primitives';
import type { IconName } from '../primitives';

interface Feature {
  icon: IconName;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'terminal',
    title: 'O cérebro roda na sua VPS',
    body: 'O Deck é só a tela. O Claude Code roda de verdade na sua máquina — suas sessões, seu uso, seus arquivos.',
  },
  {
    icon: 'message',
    title: 'Converse e execute',
    body: 'Chat com o Claude em planejar, executar ou auto. Sessões retomáveis, contextos e skills à mão.',
  },
  {
    icon: 'sparkles',
    title: 'Terminais reais',
    body: 'Abra o shell da sua VPS direto no navegador — PTY de verdade, não emulação.',
  },
  {
    icon: 'check',
    title: 'De qualquer lugar',
    body: 'Do celular ou de outro PC, é só logar na mesma conta. A chave fica na sua máquina; a privada nunca sai.',
  },
];

// Painel de introdução da tela de login (essencial do docs, sem mapa do repo).
// Presentacional. Some no mobile pra não competir com o form; aparece a partir de lg.
export function AuthIntro() {
  return (
    <div className="hidden max-w-md flex-col justify-center lg:flex">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
          <Icon name="terminal" size={16} stroke={2.4} />
        </span>
        <div>
          <div className="font-mono text-[17px] font-semibold lowercase tracking-tight text-neutral-100">deck</div>
          <div className="text-[12px] text-neutral-500">o Claude Code da sua VPS, em qualquer tela</div>
        </div>
      </div>

      <div className="space-y-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/[0.12] text-orange-300">
              <Icon name={f.icon} size={14} />
            </span>
            <div>
              <div className="text-[13px] font-medium text-neutral-200">{f.title}</div>
              <div className="text-[12px] leading-relaxed text-neutral-500">{f.body}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
        <span className="font-medium text-neutral-400">Beta · relay confiável.</span> O relay encaminha sua sessão
        pra sua VPS. A verificação ponta-a-ponta entra antes de abrir pra máquinas de terceiros.
      </p>
    </div>
  );
}
