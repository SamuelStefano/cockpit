import { Icon } from '../primitives';

interface Mic { supported: boolean; listening: boolean; toggle: () => void }

// Botão de ditado por voz ao lado do clipe. Gravando: vira vermelho e pulsa.
// Em browser sem Web Speech API (iOS Safari, Firefox) não renderiza nada — sem
// botão quebrado. A lógica vive no useSpeechInput (via useChatInput); aqui é só
// a apresentação. Não desabilita com run em curso: ditar só escreve texto.
export function MicButton({ mic }: { mic: Mic }) {
  if (!mic.supported) return null;
  return (
    <button
      onClick={mic.toggle}
      title={mic.listening ? 'Parar de ditar' : 'Ditar por voz'}
      className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition
        ${mic.listening
          ? 'animate-pulse bg-red-500/20 text-red-400'
          : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'}`}
    >
      <Icon name="mic" size={15} />
    </button>
  );
}
