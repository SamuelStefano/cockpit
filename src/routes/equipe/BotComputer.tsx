import type { TeamBot } from '../../../shared/protocol';
import { Badge, Button, Icon, SkeletonCards, tokens } from '../../components/primitives';
import type { MascotState } from '../../components/team/mascot-state';
import { computerState, diskLine, previewText, profileLine } from './computer-view';
import { useComputer } from './computer-context';

interface BotComputerProps {
  bot: TeamBot;
  state: MascotState;
}

export function BotComputer({ bot, state }: BotComputerProps) {
  const tab = useComputer();
  const st = computerState(state);
  const data = tab?.data;
  if (!tab || !data) return <div className="p-3"><SkeletonCards /></div>;
  if (data.status === 'error') {
    return <p className="p-4 text-[12.5px] text-neutral-500">Não consegui ler o computador do bot: {data.error}</p>;
  }
  const c = data.computer;
  const canTake = tab.connected && tab.isAdmin;
  const lines = tab.isAdmin ? c.preview : [];
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <section className={`${tokens.radius.lg} border border-neutral-800 bg-neutral-900/40 p-3`} aria-label="Workspace">
        <div className="flex items-center gap-2">
          <Icon name="monitor" size={14} className={tab.active ? 'text-violet-400' : 'text-neutral-500'} />
          <h3 className="text-[12.5px] font-medium text-neutral-200">Esta máquina</h3>
          <Badge tone={st.tone} dot className="ml-auto">{st.label}</Badge>
        </div>
        <p className="mt-2 break-all font-mono text-[11.5px] text-neutral-400" title="Diretório de trabalho do bot">{c.cwd}</p>
        <p className="mt-1 text-[11.5px] text-neutral-500">{diskLine(c)}</p>
        <p className="mt-2 text-[11.5px] text-neutral-500">{profileLine(bot.profile)}</p>
      </section>

      <section aria-label="Terminal do bot" className={`${tokens.radius.lg} flex flex-col overflow-hidden border border-neutral-800 bg-neutral-950`}>
        <header className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <Icon name="terminal" size={13} className="text-neutral-500" />
          <span className="text-[12px] font-medium text-neutral-300">Terminal</span>
          {!tab.takenOver && <Button variant="primary" size="sm" icon="maximize" className="ml-auto" onClick={tab.takeOver} disabled={!canTake}>Assumir</Button>}
        </header>
        {tab.takenOver ? (
          <p className="px-3 py-4 text-[12px] text-neutral-400">Você assumiu o terminal em tela cheia. Soltar devolve pro bot.</p>
        ) : lines.length ? (
          <pre aria-label="Prévia do terminal" className="max-h-80 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-snug text-neutral-400">{previewText(lines)}</pre>
        ) : (
          <p className="px-3 py-4 text-[12px] text-neutral-500">
            {c.termAlive ? 'Terminal aberto, sem saída ainda.' : 'Nenhum terminal aberto para este bot. Assumir abre um no workspace dele.'}
          </p>
        )}
      </section>
      {!tab.isAdmin && <p className="px-1 text-[11.5px] text-neutral-500">Só admin assume o terminal.</p>}
      {!tab.takenOver && (
        <div className="flex justify-end">
          <Button variant="ghost" size="xs" icon="rotate" onClick={tab.refresh} disabled={!tab.connected}>Atualizar</Button>
        </div>
      )}
    </div>
  );
}
