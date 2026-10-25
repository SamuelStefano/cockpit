import { lazy, Suspense } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import { botTermId } from '../../../shared/bot-term';
import { Badge, Button, Icon, SkeletonCards, tokens } from '../../components/primitives';
import type { MascotState } from '../../components/team/mascot-state';
import type { TermApi } from '../../cockpit/useTerminals';
import type { BotComputerApi } from './equipe-props';
import { computerState, diskLine, profileLine } from './computer-view';
import { useBotComputerTab } from './useBotComputerTab';

// Import dinâmico: xterm.js fora do grafo do entry (ver Terminals.test.tsx).
const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface BotComputerProps {
  bot: TeamBot;
  state: MascotState;
  api: BotComputerApi;
  term: TermApi;
  connected: boolean;
  isAdmin: boolean;
}

// Não há VM por bot: o computador é esta máquina e o que é do bot é o workspace.
// Por isso não existe "religar/resetar máquina" aqui — só ver e assumir.
export function BotComputer({ bot, state, api, term, connected, isAdmin }: BotComputerProps) {
  const t = useBotComputerTab(bot.id, api, connected, state);
  const st = computerState(state);
  const data = t.data;
  if (!data) return <div className="p-3"><SkeletonCards /></div>;
  if (data.status === 'error') {
    return <p className="p-4 text-[12.5px] text-neutral-500">Não consegui ler o computador do bot: {data.error}</p>;
  }
  const c = data.computer;
  const canTake = connected && isAdmin;
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <section className={`${tokens.radius.lg} border border-neutral-800 bg-neutral-900/40 p-3`} aria-label="Workspace">
        <div className="flex items-center gap-2">
          <Icon name="monitor" size={14} className="text-neutral-500" />
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
          {t.takenOver
            ? <Button variant="ghost" size="sm" icon="x" className="ml-auto" onClick={t.release}>Soltar</Button>
            : <Button variant="primary" size="sm" icon="terminal" className="ml-auto" onClick={t.takeOver} disabled={!canTake}>Assumir</Button>}
        </header>
        {t.takenOver ? (
          <div className="h-72">
            <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
              <XtermView id={botTermId(bot.id)} botId={bot.id} term={term} />
            </Suspense>
          </div>
        ) : isAdmin && c.termAlive && c.preview.length ? (
          <pre aria-label="Prévia do terminal" className="max-h-56 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-snug text-neutral-400">{c.preview.join('\n')}</pre>
        ) : (
          <p className="px-3 py-4 text-[12px] text-neutral-500">
            {c.termAlive ? 'Terminal aberto, sem saída ainda.' : 'Nenhum terminal aberto para este bot. Assumir abre um no workspace dele.'}
          </p>
        )}
      </section>
      {!isAdmin && <p className="px-1 text-[11.5px] text-neutral-500">Só admin assume o terminal.</p>}
      {!t.takenOver && (
        <div className="flex justify-end">
          <Button variant="ghost" size="xs" icon="rotate" onClick={t.refresh} disabled={!connected}>Atualizar</Button>
        </div>
      )}
    </div>
  );
}
