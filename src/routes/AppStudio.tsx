import { useMemo, useState } from 'react';
import { Badge, Button } from '../components/primitives';
import { download } from '../lib/export';
import { useCopied } from '../lib/useCopied';
import { APP_SCOPE_NAMES } from '../lib/appSandboxScope';
import { useAppSandbox } from '../components/primitives/livepreview/useAppSandbox';
import { SandboxBoundary } from '../components/primitives/livepreview/SandboxBoundary';
import { CodeEditor } from '../components/primitives/livepreview/CodeEditor';
import { ConsolePanel } from '../components/primitives/livepreview/ConsolePanel';
import { VIEWPORTS } from '../components/primitives/livepreview/viewports';

// Bancada do modo App: editor à esquerda, palco à direita montando o componente
// na MESMA árvore React do Deck, com os primitivos de verdade em escopo. É o que
// separa este modo do playground de iframe — aqui o que aparece é o app.
export function AppStudio({ code }: { code: string }) {
  const { draft, setDraft, Component, error, runId, logs, clearLogs, dirty, reset, onRuntimeError } = useAppSandbox(code);
  const [vp, setVp] = useState('fluid');
  const [showConsole, setShowConsole] = useState(false);
  const [showScope, setShowScope] = useState(false);
  const [copied, copy] = useCopied(1200);
  // O console do sandbox realimenta `logs` a cada flush; sem memo o elemento seria
  // recriado e o componente do usuário remontaria (perdendo estado) a cada log.
  const stage = useMemo(() => (Component ? <Component /> : null), [Component]);

  const width = VIEWPORTS.find((v) => v.id === vp)?.width ?? null;
  const accent = (active: boolean) => (active ? 'text-orange-200 hover:text-orange-100' : '');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
            {VIEWPORTS.map((v) => (
              <Button key={v.id} size="sm" square icon={v.icon} title={v.label} onClick={() => setVp(v.id)}
                variant={vp === v.id ? 'secondary' : 'ghost'} className={accent(vp === v.id)} />
            ))}
          </div>
          <Button size="sm" square icon="tag" variant="ghost" className={accent(showScope)}
            title="O que está em escopo" onClick={() => setShowScope((s) => !s)} />
        </div>
        <div className="flex items-center gap-1">
          {dirty && <Button size="sm" square icon="rotate" variant="ghost" title="Voltar ao cenário" onClick={reset} />}
          <Button size="sm" square icon="terminal" variant="ghost" title="Console"
            className={`relative ${accent(showConsole)}`} onClick={() => setShowConsole((s) => !s)}>
            {logs.length > 0 && !showConsole && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />}
          </Button>
          <Button size="sm" square icon={copied ? 'check' : 'copy'} variant="ghost" title="Copiar código" onClick={() => copy(draft)} />
          <Button size="sm" square icon="download" variant="ghost" title="Baixar código"
            onClick={() => download('sandbox.tsx', 'text/plain', draft)} />
        </div>
      </div>

      {showScope && (
        <div className="flex flex-wrap gap-1 border-b border-neutral-800 bg-neutral-900/40 px-3 py-2">
          <span className="mr-1 text-[11px] text-neutral-500">sem import, já em escopo:</span>
          {APP_SCOPE_NAMES.map((n) => (
            <code key={n} className="rounded bg-neutral-800/80 px-1.5 py-0.5 font-mono text-[10.5px] text-neutral-300">{n}</code>
          ))}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="min-h-0 border-b border-neutral-800 md:border-b-0 md:border-r">
          <CodeEditor value={draft} onChange={setDraft} mode="react" heightClass="h-full" />
        </div>
        <div className="relative min-h-0 overflow-auto bg-neutral-950">
          <div className="mx-auto" style={width ? { width, maxWidth: '100%' } : undefined}>
            <SandboxBoundary key={runId} onError={onRuntimeError}>{stage}</SandboxBoundary>
          </div>
          {error && (
            <div className="absolute inset-0 z-30 flex items-start bg-[#0c0c0c]/95 p-3">
              <pre className="scroll-thin max-h-full overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-snug text-red-400">{error}</pre>
            </div>
          )}
          {!Component && !error && (
            <div className="p-6 text-center text-[12px] text-neutral-600">
              <Badge tone="neutral">aguardando um export default</Badge>
            </div>
          )}
        </div>
      </div>

      {showConsole && <div className="max-h-48 shrink-0 overflow-hidden border-t border-neutral-800"><ConsolePanel logs={logs} onClear={clearLogs} /></div>}
    </div>
  );
}
