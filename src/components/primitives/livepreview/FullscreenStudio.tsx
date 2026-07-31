import { useState, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { Modal } from '../Modal';
import { ConsolePanel } from './ConsolePanel';
import { ctrlBtn } from './ErrorOverlay';
import type { LogEntry } from './useLivePreview';

// Modo "estúdio": editor e preview lado a lado, ambos ao vivo — editar o código à
// esquerda re-renderiza a tela à direita na hora. É o "alteração de código em
// tempo real" em tela cheia. Recebe os MESMOS elementos de editor/frame do card
// (uma instância só do iframe), então o rascunho é compartilhado.
export function FullscreenStudio({
  open, onClose, editor, frame, logs, onClearLogs,
  title = 'Studio — código ao vivo', startWide = false,
}: {
  open: boolean;
  onClose: () => void;
  editor: ReactNode;
  frame: ReactNode;
  logs: LogEntry[];
  onClearLogs: () => void;
  title?: string;
  /** Abre já sem o editor: tela do repo alvo costuma precisar da largura toda. */
  startWide?: boolean;
}) {
  const [wide, setWide] = useState(startWide);

  return (
    <Modal open={open} onClose={onClose} title={title} icon="maximize" maxWidth="max-w-[96vw]">
      <div className="flex h-[82vh] flex-col gap-2">
        <div className={`grid min-h-0 flex-1 gap-2 ${wide ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {!wide && (
            <div className="relative min-h-0 overflow-hidden rounded-lg border border-neutral-800">
              {editor}
            </div>
          )}
          <div className="relative min-h-0 overflow-auto rounded-lg border border-neutral-800 bg-white">
            <button onClick={() => setWide((w) => !w)} title={wide ? 'Mostrar editor' : 'Esconder editor (tela inteira)'}
              className={`${ctrlBtn(false)} absolute right-2 top-2 z-10 bg-neutral-900/80`}>
              <Icon name={wide ? 'code' : 'maximize'} size={12} />
            </button>
            {frame}
          </div>
        </div>
        <div className="max-h-40 shrink-0 overflow-hidden rounded-lg border border-neutral-800">
          <ConsolePanel logs={logs} onClear={onClearLogs} />
        </div>
      </div>
    </Modal>
  );
}
