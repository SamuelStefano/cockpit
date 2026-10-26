import { Badge, Button, Icon, tokens } from '../../components/primitives';
import type { MascotState } from '../../components/team/mascot-state';
import { computerState, diskLine, previewText } from './computer-view';

interface ComputerPreviewPaneProps {
  cwd: string;
  files: number;
  bytes: number;
  truncated: boolean;
  state: MascotState;
  preview: string[];
  termAlive: boolean;
  isAdmin: boolean;
  isMobile: boolean;
  canTake: boolean;
  onTakeOver: () => void;
  onClose: () => void;
  onRefresh: () => void;
  connected: boolean;
}

export function ComputerPreviewPane({
  cwd, files, bytes, truncated, state, preview, termAlive, isAdmin, isMobile,
  canTake, onTakeOver, onClose, onRefresh, connected,
}: ComputerPreviewPaneProps) {
  const st = computerState(state);
  const lines = isAdmin ? preview : [];
  const frame = isMobile
    ? 'flex max-h-48 w-full shrink-0 flex-col border-t border-neutral-800 bg-neutral-950'
    : 'flex h-full w-72 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950';
  return (
    <aside className={frame} aria-label="Prévia do computador">
      <header className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <Icon name="monitor" size={13} className="text-violet-400" />
        <span className="text-[12px] font-medium text-neutral-200">Computador</span>
        <Badge tone={st.tone} dot className="ml-auto">{st.label}</Badge>
        <Button variant="ghost" size="xs" icon="x" square aria-label="Fechar prévia" onClick={onClose} />
      </header>
      <p className="break-all px-3 pt-2 font-mono text-[11px] text-neutral-400" title="Diretório de trabalho do bot">{cwd}</p>
      <p className="px-3 pt-1 text-[11px] text-neutral-500">{diskLine({ files, bytes, truncated })}</p>
      {lines.length ? (
        <pre aria-label="Prévia do terminal" className="scroll-thin min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-snug text-neutral-400">{previewText(lines)}</pre>
      ) : (
        <p className="px-3 py-3 text-[12px] text-neutral-500">
          {termAlive ? 'Terminal aberto, sem saída ainda.' : 'Nenhum terminal aberto. Assumir abre um no workspace dele.'}
        </p>
      )}
      <footer className={`flex items-center gap-2 border-t border-neutral-800 px-3 py-2 ${tokens.surface.base}`}>
        <Button variant="primary" size="sm" icon="maximize" onClick={onTakeOver} disabled={!canTake}>Assumir</Button>
        <Button variant="ghost" size="xs" icon="rotate" onClick={onRefresh} disabled={!connected}>Atualizar</Button>
        {!isAdmin && <span className="text-[11px] text-neutral-500">Só admin assume.</span>}
      </footer>
    </aside>
  );
}
