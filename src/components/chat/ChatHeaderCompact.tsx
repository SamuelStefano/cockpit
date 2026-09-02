import { Button, Icon } from '../primitives';

// Cabeçalho do chat com o TECLADO ABERTO: uma linha de 32px com título e
// terminal. Com ~420px de viewport, cada controle a mais no topo (contexto,
// histórico, exportar) custa uma mensagem inteira do thread.
export function ChatHeaderCompact({ title, onTerminal, terminalRunning }: {
  title: string;
  onTerminal?: () => void;
  terminalRunning?: boolean;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-neutral-800 px-4">
      <Icon name="message" size={13} className="shrink-0 text-neutral-500" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-300">{title}</span>
      {onTerminal && (
        <Button variant="ghost" size="sm" square icon="terminal" onClick={onTerminal} title="Abrir terminais" className="relative -mr-1">
          {terminalRunning && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-neutral-900 bg-green-500" />
          )}
        </Button>
      )}
    </div>
  );
}
