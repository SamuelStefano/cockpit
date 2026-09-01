import { useState } from 'react';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { tokens } from '../tokens';
import { useCopied } from '../../../lib/useCopied';
import { download } from '../../../lib/export';
import { useBench } from './useBench';
import { IFRAME_HTML_BENCH } from './iframeHtmlBench';
import { CodeEditor } from './CodeEditor';
import { ConsolePanel } from './ConsolePanel';
import { ErrorOverlay, ctrlBtn } from './ErrorOverlay';
import { FullscreenStudio } from './FullscreenStudio';
import { PreviewFrame } from './PreviewFrame';
import { VIEWPORTS } from './viewports';

type Tab = 'preview' | 'code';

// Bench: roda um componente de OUTRO repo (o da PR) dentro do chat. O servidor
// compila contra aquele repo e devolve bundle + tema; aqui só editamos e
// olhamos. Mesma casca do live preview, mas a tela é o app de verdade.
export function BenchPreview({ code, repo }: { code: string; repo: string }) {
  const { ref, draft, setDraft, bundle, building, error, height, logs, dirty, armed, arm, reset, clearLogs } = useBench(code, repo);
  const [tab, setTab] = useState<Tab>('preview');
  const [vp, setVp] = useState('fluid');
  const [showConsole, setShowConsole] = useState(false);
  const [full, setFull] = useState(false);
  const [copied, copy] = useCopied(1200);

  const width = VIEWPORTS.find((v) => v.id === vp)?.width ?? null;

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-orange-500/25 bg-[#0c0c0c]">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-neutral-800 px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-orange-300/80">
          <Icon name="zap" size={11} /> bench · {repo}
          {building && <span className="text-neutral-500">· compilando…</span>}
          {!building && bundle && <span className="text-neutral-600">· {bundle.ms}ms</span>}
          {dirty && <span className="text-neutral-500">· editado</span>}
        </span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
            {VIEWPORTS.map((v) => (
              <button key={v.id} onClick={() => setVp(v.id)} title={v.label} className={`rounded-sm p-1 transition ${vp === v.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`}>
                <Icon name={v.icon} size={11} />
              </button>
            ))}
          </div>
          <button onClick={() => setShowConsole((s) => !s)} title="Console" className={ctrlBtn(showConsole)}>
            <Icon name="terminal" size={12} />
            {logs.length > 0 && !showConsole && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />}
          </button>
          {armed && <button onClick={() => setFull(true)} title="Abrir no studio (tela cheia)" className={ctrlBtn(false)}><Icon name="maximize" size={12} /></button>}
          {dirty && <button onClick={reset} title="Voltar ao código original" className={ctrlBtn(false)}><Icon name="rotate" size={12} /></button>}
          <button onClick={() => copy(draft)} title="Copiar código" className={ctrlBtn(false)}><Icon name={copied ? 'check' : 'copy'} size={12} /></button>
          <button onClick={() => download('bench.tsx', 'text/plain', draft)} title="Baixar código" className={ctrlBtn(false)}><Icon name="download" size={12} /></button>
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
            {(['preview', 'code'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-sm px-2 py-0.5 text-[10px] transition ${tab === t ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'} ${tokens.focusRing}`}>
                {t === 'preview' ? 'tela' : 'código'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'code' ? <CodeEditor value={draft} onChange={setDraft} mode="react" /> : !armed ? (
        <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
          <p className="max-w-sm text-[11.5px] leading-snug text-neutral-500">
            Compila contra o repo <span className="text-neutral-300">{repo}</span> e roda aqui. Leva alguns segundos.
          </p>
          <Button size="sm" icon="play" onClick={arm}>compilar</Button>
        </div>
      ) : full ? (
        <div className="px-3 py-6 text-center font-mono text-[11px] text-neutral-600">aberto no studio…</div>
      ) : (
        <PreviewFrame
          frameRef={ref}
          mode="react"
          height={height}
          width={width}
          srcDoc={IFRAME_HTML_BENCH}
          title={`bench ${repo}`}
          overlay={error ? <ErrorOverlay message={error} /> : null}
        />
      )}
      {showConsole && !full && <ConsolePanel logs={logs} onClear={clearLogs} />}

      <FullscreenStudio
        open={full}
        onClose={() => setFull(false)}
        title={`Bench — ${repo}`}
        startWide
        logs={logs}
        onClearLogs={clearLogs}
        editor={<CodeEditor value={draft} onChange={setDraft} mode="react" heightClass="h-full" />}
        frame={
          <PreviewFrame
            frameRef={ref}
            mode="react"
            height={height}
            width={null}
            fill
            srcDoc={IFRAME_HTML_BENCH}
            title={`bench ${repo}`}
            overlay={error ? <ErrorOverlay message={error} /> : null}
          />
        }
      />
    </div>
  );
}
