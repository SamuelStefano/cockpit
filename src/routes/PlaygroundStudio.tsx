import { useState } from 'react';
import { Icon } from '../components/primitives/Icon';
import { download } from '../lib/export';
import { useCopied } from '../lib/useCopied';
import { useLivePreview, type Mode } from '../components/primitives/livepreview/useLivePreview';
import { CodeEditor } from '../components/primitives/livepreview/CodeEditor';
import { PreviewFrame } from '../components/primitives/livepreview/PreviewFrame';
import { ConsolePanel } from '../components/primitives/livepreview/ConsolePanel';
import { VIEWPORTS } from '../components/primitives/livepreview/viewports';

const EXT: Record<Mode, string> = { html: 'html', react: 'tsx', native: 'tsx', svg: 'svg', test: 'ts' };

// Studio do playground: editor à esquerda, tela viva à direita, console embaixo —
// tudo ligado a um único useLivePreview (mesmo iframe/rascunho). Difere do card
// do chat (LivePreview) por ser página cheia e sem o barramento de refino.
export function PlaygroundStudio({ code, mode }: { code: string; mode: Mode }) {
  const { ref, draft, setDraft, error, height, logs, tests, dirty, reset, clearLogs } = useLivePreview(code, mode);
  const [vp, setVp] = useState('fluid');
  const [showConsole, setShowConsole] = useState(false);
  const [copied, copy] = useCopied(1200);

  const sized = mode === 'react' || mode === 'html';
  const width = sized ? (VIEWPORTS.find((v) => v.id === vp)?.width ?? null) : null;
  const passed = tests.filter((t) => t.pass).length;
  const ctrl = (active: boolean) => `relative rounded p-1.5 transition ${active ? 'text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`;

  const overlay = error && (
    <div className="absolute inset-0 z-30 flex items-start bg-[#0c0c0c]/95 p-3">
      <pre className="scroll-thin max-h-full overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-snug text-red-400">{error}</pre>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {sized && (
            <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
              {VIEWPORTS.map((v) => (
                <button key={v.id} onClick={() => setVp(v.id)} title={v.label}
                  className={`rounded p-1 transition ${vp === v.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  <Icon name={v.icon} size={12} />
                </button>
              ))}
            </div>
          )}
          {mode === 'test' && tests.length > 0 && (
            <span className={`font-mono text-[11px] ${passed === tests.length ? 'text-green-400' : 'text-red-400'}`}>{passed}/{tests.length} ✓</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {dirty && <button onClick={reset} title="Voltar ao template" className={ctrl(false)}><Icon name="rotate" size={13} /></button>}
          <button onClick={() => setShowConsole((s) => !s)} title="Console" className={ctrl(showConsole)}>
            <Icon name="terminal" size={13} />
            {logs.length > 0 && !showConsole && <span className="absolute -right-0 -top-0 h-1.5 w-1.5 rounded-full bg-orange-400" />}
          </button>
          <button onClick={() => copy(draft)} title="Copiar código" className={ctrl(false)}><Icon name={copied ? 'check' : 'copy'} size={13} /></button>
          <button onClick={() => download(`playground.${EXT[mode]}`, 'text/plain', draft)} title="Baixar código" className={ctrl(false)}><Icon name="download" size={13} /></button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <div className="min-h-0 border-b border-neutral-800 md:border-b-0 md:border-r">
          <CodeEditor value={draft} onChange={setDraft} mode={mode} heightClass="h-full" />
        </div>
        <div className="relative min-h-0 overflow-auto bg-neutral-950">
          <PreviewFrame frameRef={ref} mode={mode} height={height} width={width} overlay={overlay} />
        </div>
      </div>

      {showConsole && <div className="max-h-48 shrink-0 overflow-hidden border-t border-neutral-800"><ConsolePanel logs={logs} onClear={clearLogs} /></div>}
    </div>
  );
}
