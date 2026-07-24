import { useState } from 'react';
import { Icon } from '../Icon';
import { tokens } from '../tokens';
import { download } from '../../../lib/export';
import { useCopied } from '../../../lib/useCopied';
import { requestRefine } from './refine-bus';
import { useLivePreview, type Mode } from './useLivePreview';
import { PreviewFrame } from './PreviewFrame';
import { CodeEditor } from './CodeEditor';
import { ConsolePanel } from './ConsolePanel';
import { FullscreenStudio } from './FullscreenStudio';
import { VIEWPORTS } from './viewports';

type Tab = 'preview' | 'code';

function modeOf(lang: string): Mode {
  if (lang === 'preview-html') return 'html';
  if (lang === 'preview-native') return 'native';
  return 'react';
}
const EXT: Record<Mode, string> = { html: 'html', react: 'tsx', native: 'tsx' };

// Renderiza código do assistente como TELA rodando num iframe sandbox (origem
// opaca). O código é EDITÁVEL (aba código): digitar re-renderiza a tela ao vivo.
// Barra: switcher de viewport (web), console capturado, tela cheia (studio
// split), tabs tela/código. Rodapé: refino que devolve o pedido pro chat.
export function LivePreview({ code, lang }: { code: string; lang: string }) {
  const mode = modeOf(lang);
  const { ref, draft, setDraft, error, height, logs, dirty, reset, clearLogs } = useLivePreview(code, mode);
  const [tab, setTab] = useState<Tab>('preview');
  const [vp, setVp] = useState('fluid');
  const [showConsole, setShowConsole] = useState(false);
  const [full, setFull] = useState(false);
  const [refine, setRefine] = useState('');
  const [copied, copy] = useCopied(1200);

  const width = mode === 'native' ? null : (VIEWPORTS.find((v) => v.id === vp)?.width ?? null);
  const label = mode === 'native' ? ' · iphone' : mode === 'html' ? ' · html' : '';
  const submitRefine = () => { requestRefine(refine); setRefine(''); };

  const overlay = error && (
    <div className="absolute inset-0 z-30 flex items-start bg-[#0c0c0c]/95 p-3">
      <pre className="scroll-thin max-h-full overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-snug text-red-400">{error}</pre>
    </div>
  );
  const editor = <CodeEditor value={draft} onChange={setDraft} mode={mode} />;

  const ctrlBtn = (active: boolean) => `relative rounded p-1 transition ${active ? 'text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`;

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-orange-500/25 bg-[#0c0c0c]">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-neutral-800 px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-orange-300/80">
          <Icon name={mode === 'native' ? 'smartphone' : 'zap'} size={11} /> live preview{label}
          {dirty && <span className="text-neutral-500">· editado</span>}
        </span>
        <div className="flex items-center gap-1">
          {mode !== 'native' && (
            <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
              {VIEWPORTS.map((v) => (
                <button key={v.id} onClick={() => setVp(v.id)} title={v.label} className={`rounded p-1 transition ${vp === v.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  <Icon name={v.icon} size={11} />
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowConsole((s) => !s)} title="Console" className={ctrlBtn(showConsole)}>
            <Icon name="terminal" size={12} />
            {logs.length > 0 && !showConsole && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-orange-400" />}
          </button>
          <button onClick={() => setFull(true)} title="Abrir no studio (tela cheia)" className={ctrlBtn(false)}><Icon name="maximize" size={12} /></button>
          {dirty && <button onClick={reset} title="Voltar ao código original" className={ctrlBtn(false)}><Icon name="rotate" size={12} /></button>}
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-900 p-0.5">
            {(['preview', 'code'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-0.5 text-[10px] transition ${tab === t ? 'bg-neutral-800 text-orange-200' : 'text-neutral-500 hover:text-neutral-300'} ${tokens.focusRing}`}>
                {t === 'preview' ? 'tela' : 'código'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {full ? (
        <div className="px-3 py-6 text-center font-mono text-[11px] text-neutral-600">aberto no studio…</div>
      ) : tab === 'code' ? editor : (
        <PreviewFrame frameRef={ref} mode={mode} height={height} width={width} overlay={overlay} />
      )}
      {showConsole && !full && <ConsolePanel logs={logs} onClear={clearLogs} />}

      <div className="flex items-center gap-1.5 border-t border-neutral-800 px-2 py-1.5">
        <Icon name="zap" size={11} className="shrink-0 text-neutral-600" />
        <input value={refine} onChange={(e) => setRefine(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitRefine(); }}
          placeholder="refina esta tela… (ex: deixa mais escuro, adiciona um botão)"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-neutral-200 placeholder:text-neutral-600 focus:outline-none" />
        <button onClick={() => copy(draft)} title="Copiar código" className={ctrlBtn(false)}><Icon name={copied ? 'check' : 'copy'} size={12} /></button>
        <button onClick={() => download(`preview.${EXT[mode]}`, 'text/plain', draft)} title="Baixar código" className={ctrlBtn(false)}><Icon name="download" size={12} /></button>
        <button onClick={submitRefine} disabled={!refine.trim()}
          className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${refine.trim() ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25' : 'text-neutral-600'} ${tokens.focusRing}`}>
          refinar
        </button>
      </div>

      <FullscreenStudio open={full} onClose={() => setFull(false)} logs={logs} onClearLogs={clearLogs}
        editor={<CodeEditor value={draft} onChange={setDraft} mode={mode} heightClass="h-full" />}
        frame={<PreviewFrame frameRef={ref} mode={mode} height={height} width={null} overlay={overlay} />} />
    </div>
  );
}
