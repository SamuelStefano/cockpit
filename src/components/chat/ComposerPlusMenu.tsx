import { Icon, tokens } from '../primitives';
import { useComposerPlusMenu } from './useComposerPlusMenu';
import type { Mic } from './mic-types';

const item = `flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-neutral-200 transition hover:bg-neutral-800/60 ${tokens.focusRing}`;

// No toque, clipe e microfone ocupavam dois slots de 32px na base do composer.
// Viram um `+` só, com o mini-menu que todo app de mensagem tem. A câmera é um
// input separado (`capture`) porque o seletor de arquivo genérico do Android não
// abre a câmera traseira direto.
export function ComposerPlusMenu({ mic, onAttach, onPhoto }: {
  mic: Mic;
  onAttach: () => void;
  onPhoto: () => void;
}) {
  const { open, toggle, close, run, wrapRef } = useComposerPlusMenu();
  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label="Anexar, fotografar ou ditar"
        aria-expanded={open}
        title={mic.error ?? 'Anexar arquivo, tirar foto ou ditar'}
        className={`mb-0.5 flex h-8 w-8 items-center justify-center rounded-lg transition ${tokens.focusRing}
          ${mic.listening
            ? 'animate-pulse bg-red-500/20 text-red-400'
            : open
            ? 'bg-neutral-800 text-neutral-200'
            : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200'}`}
      >
        <Icon name={mic.listening ? 'mic' : 'plus'} size={mic.listening ? 15 : 18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div role="menu" aria-label="Ações do composer" className="absolute bottom-full left-0 z-40 mb-2 w-48 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl shadow-black/50">
            <button type="button" role="menuitem" className={item} onClick={() => run(onAttach)}>
              <Icon name="paperclip" size={14} className="text-neutral-500" /> Anexar arquivo
            </button>
            <button type="button" role="menuitem" className={item} onClick={() => run(onPhoto)}>
              <Icon name="camera" size={14} className="text-neutral-500" /> Tirar foto
            </button>
            {mic.supported && (
              <button type="button" role="menuitem" className={item} onClick={() => run(mic.toggle)}>
                <Icon name="mic" size={14} className="text-neutral-500" /> {mic.listening ? 'Parar de ditar' : 'Ditar'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
