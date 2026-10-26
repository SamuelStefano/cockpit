import { lazy, Suspense } from 'react';
import { Button, Icon } from '../../components/primitives';
import { useEscapeLayer } from '../../components/primitives/useEscapeLayer';
import { botTermId } from '../../../shared/bot-term';
import type { TeamBot } from '../../../shared/protocol';
import type { TermApi } from '../../cockpit/useTerminals';

const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface ComputerTakeoverProps {
  bot: TeamBot;
  term: TermApi;
  onRelease: () => void;
}

export function ComputerTakeover({ bot, term, onRelease }: ComputerTakeoverProps) {
  useEscapeLayer(true, onRelease);
  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-neutral-950" role="dialog" aria-modal="true" aria-label={`Computador de ${bot.name}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <Icon name="monitor" size={14} className="text-violet-400" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-100">{bot.name} · esta máquina</span>
        <Button variant="ghost" size="sm" icon="x" onClick={onRelease}>Soltar</Button>
      </header>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
          <XtermView id={botTermId(bot.id)} botId={bot.id} term={term} />
        </Suspense>
      </div>
    </div>
  );
}
