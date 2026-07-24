import { useMemo, useState } from 'react';
import { Icon } from '../components/primitives/Icon';
import { Badge } from '../components/primitives';
import { tokens } from '../components/primitives/tokens';
import { modeOf } from '../components/primitives/livepreview/useLivePreview';
import { PlaygroundStudio } from './PlaygroundStudio';
import { LANGS, TEMPLATES } from './playground-templates';
import { readShareFromLocation } from '../lib/playgroundShare';

// Rota /play: bancada standalone pra editar código e ver rodando ao vivo em
// qualquer runtime do live preview (React, HTML, iPhone, SVG, juiz de testes).
// key no Studio = linguagem+template → troca sempre recarrega o iframe do zero.
export function Playground() {
  // Abriu por link compartilhado (#c=...)? Semeia com o código do link. Trocar de
  // linguagem/template limpa o estado compartilhado e volta pros templates.
  const initial = useMemo(() => {
    const s = readShareFromLocation();
    return s && LANGS.some((l) => l.id === s.lang) ? s : null;
  }, []);
  const [shared, setShared] = useState(initial);
  const [langId, setLangId] = useState(initial?.lang ?? 'preview');
  const [tplId, setTplId] = useState('react-counter');

  const templatesForLang = TEMPLATES.filter((t) => t.lang === langId);
  const active = TEMPLATES.find((t) => t.id === tplId) ?? templatesForLang[0];
  const mode = modeOf(langId);
  const code = shared ? shared.code : active.code;
  const studioKey = shared ? `shared:${langId}` : `${langId}:${tplId}`;

  const pickLang = (id: string) => {
    setShared(null);
    setLangId(id);
    const first = TEMPLATES.find((t) => t.lang === id);
    if (first) setTplId(first.id);
  };
  const pickTpl = (id: string) => { setShared(null); setTplId(id); };

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="zap" className="text-orange-400" size={16} />
          <h1 className="text-sm font-semibold text-neutral-200">Playground</h1>
          {shared
            ? <Badge tone="orange" dot>aberto de link</Badge>
            : <span className="hidden text-[11px] text-neutral-500 sm:inline">edite e veja rodar ao vivo — React, HTML, iPhone, SVG e testes</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-neutral-900 p-0.5">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => pickLang(l.id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition ${langId === l.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-400 hover:text-neutral-200'} ${tokens.focusRing}`}>
                <Icon name={l.icon} size={12} /> {l.label}
              </button>
            ))}
          </div>
          {templatesForLang.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-lg bg-neutral-900 p-0.5">
              {templatesForLang.map((t) => (
                <button key={t.id} onClick={() => pickTpl(t.id)}
                  className={`rounded-md px-2.5 py-1 text-[12px] transition ${!shared && tplId === t.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-400 hover:text-neutral-200'} ${tokens.focusRing}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <PlaygroundStudio key={studioKey} code={code} mode={mode} lang={langId} />
    </div>
  );
}
