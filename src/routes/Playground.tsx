import { useState } from 'react';
import { Icon } from '../components/primitives/Icon';
import { tokens } from '../components/primitives/tokens';
import { modeOf } from '../components/primitives/livepreview/useLivePreview';
import { PlaygroundStudio } from './PlaygroundStudio';
import { LANGS, TEMPLATES } from './playground-templates';

// Rota /play: bancada standalone pra editar código e ver rodando ao vivo em
// qualquer runtime do live preview (React, HTML, iPhone, SVG, juiz de testes).
// key no Studio = linguagem+template → troca sempre recarrega o iframe do zero.
export function Playground() {
  const [langId, setLangId] = useState('preview');
  const [tplId, setTplId] = useState('react-counter');

  const templatesForLang = TEMPLATES.filter((t) => t.lang === langId);
  const active = TEMPLATES.find((t) => t.id === tplId) ?? templatesForLang[0];
  const mode = modeOf(langId);

  const pickLang = (id: string) => {
    setLangId(id);
    const first = TEMPLATES.find((t) => t.lang === id);
    if (first) setTplId(first.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon name="zap" className="text-orange-400" size={16} />
          <h1 className="text-sm font-semibold text-neutral-200">Playground</h1>
          <span className="hidden text-[11px] text-neutral-500 sm:inline">edite e veja rodar ao vivo — React, HTML, iPhone, SVG e testes</span>
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
                <button key={t.id} onClick={() => setTplId(t.id)}
                  className={`rounded-md px-2.5 py-1 text-[12px] transition ${tplId === t.id ? 'bg-neutral-800 text-orange-200' : 'text-neutral-400 hover:text-neutral-200'} ${tokens.focusRing}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <PlaygroundStudio key={`${langId}:${tplId}`} code={active.code} mode={mode} />
    </div>
  );
}
