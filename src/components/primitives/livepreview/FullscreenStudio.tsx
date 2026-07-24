import type { ReactNode } from 'react';
import { Modal } from '../Modal';
import { ConsolePanel } from './ConsolePanel';
import type { LogEntry } from './useLivePreview';

// Modo "estúdio": editor e preview lado a lado, ambos ao vivo — editar o código à
// esquerda re-renderiza a tela à direita na hora. É o "alteração de código em
// tempo real" em tela cheia. Recebe os MESMOS elementos de editor/frame do card
// (uma instância só do iframe), então o rascunho é compartilhado.
export function FullscreenStudio({
  open, onClose, editor, frame, logs, onClearLogs,
}: {
  open: boolean;
  onClose: () => void;
  editor: ReactNode;
  frame: ReactNode;
  logs: LogEntry[];
  onClearLogs: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Studio — código ao vivo" icon="maximize" maxWidth="max-w-[96vw]">
      <div className="flex h-[78vh] flex-col gap-2">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
          <div className="relative min-h-0 overflow-hidden rounded-lg border border-neutral-800">
            {editor}
          </div>
          <div className="min-h-0 overflow-auto rounded-lg border border-neutral-800 bg-white">
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
