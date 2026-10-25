import { lazy, Suspense } from 'react';
import { useIsMobile } from '../app/useIsMobile';
import { Button, Icon } from '../components/primitives';
import type { TermApi } from '../cockpit/useTerminals';
import type { AgentTerminalApi } from './useAgentTerminal';
import { useRevealOnOpen } from './useRevealOnOpen';

const XtermView = lazy(() => import('../components/Xterm').then((m) => ({ default: m.XtermView })));

const RUNNING_TEXT = {
  install: { text: 'Instalando… quando terminar eu testo sozinho.', cta: 'Pronto' },
  login: { text: 'Confirme o link ou código que apareceu no terminal.', cta: 'Pronto, já entrei' },
  test: { text: 'Rodando…', cta: 'Pronto' },
} as const;

interface AgentTerminalProps {
  api: AgentTerminalApi;
  term: TermApi;
  name: string;
}

export function AgentTerminal({ api, term, name }: AgentTerminalProps) {
  const isMobile = useIsMobile();
  const ref = useRevealOnOpen<HTMLElement>(api.open && !isMobile);
  if (!api.open) return null;
  const running = api.running ? RUNNING_TEXT[api.running.kind] : null;
  const frame = isMobile
    ? 'fixed inset-0 z-60 flex flex-col bg-neutral-950'
    : 'flex h-80 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950';
  return (
    <section ref={ref} role="region" aria-label={`Terminal do ${name}`} className={frame}>
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 px-3 py-2">
        {isMobile && <Button variant="ghost" size="sm" icon="chevronLeft" onClick={api.hide}>Voltar</Button>}
        <Icon name="terminal" size={13} className="text-neutral-500" />
        <span className="text-[12.5px] font-medium text-neutral-200">Terminal · {name}</span>
        {!isMobile && <Button variant="ghost" size="sm" icon="x" className="ml-auto" onClick={api.hide} aria-label="Ocultar terminal">Ocultar</Button>}
      </header>
      {running && (
        <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-orange-500/20 bg-orange-500/5 px-3 py-2">
          <span className="agent-phrase min-w-0 flex-1 basis-48 text-[12px] text-orange-200">{running.text}</span>
          <Button variant="primary" size="sm" icon="check" onClick={api.finish}>{running.cta}</Button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
          <XtermView id={api.termId} term={term} onOutput={api.onOutput} />
        </Suspense>
      </div>
    </section>
  );
}
