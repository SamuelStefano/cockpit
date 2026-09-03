import { Button, Icon, tokens } from '../primitives';
import { MicButton } from './MicButton';
import { ComposerPlusMenu } from './ComposerPlusMenu';
import type { Mic } from './mic-types';

// Cluster à esquerda do textarea. Os sliders só aparecem no modo compacto, quando a
// barra de ajustes sai de cena: sem eles não haveria nenhum caminho pro modelo/esforço
// sem antes fechar o teclado.
export function ComposerTools({ touch, compact, mic, onAttach, onPhoto, onOpenSettings }: {
  touch: boolean;
  compact: boolean;
  mic: Mic;
  onAttach: () => void;
  onPhoto: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {touch ? (
        <ComposerPlusMenu mic={mic} onAttach={onAttach} onPhoto={onPhoto} />
      ) : (
        <>
          <Button
            variant="ghost"
            square
            icon="paperclip"
            onClick={onAttach}
            title="Anexar arquivo — ou arraste e solte / cole (Ctrl+V). Vai junto no próximo envio."
            className="mb-0.5"
          />
          <MicButton mic={mic} />
        </>
      )}
      {compact && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Ajustes do próximo prompt"
          title="Modelo, esforço, skills, MCP e permissões do próximo prompt"
          className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 ${tokens.focusRing}`}
        >
          <Icon name="sliders" size={16} />
        </button>
      )}
    </div>
  );
}
