import { useEffect, useState } from 'react';
import type { HighlighterCore } from 'shiki/core';

export interface ShToken {
  content: string;
  color?: string;
  fontStyle?: number; // bitmask do shiki: 1 itálico, 2 negrito, 4 sublinhado
}

const THEME = 'github-dark';
// Só o que NÃO é alias declarado por alguma gramática: `sh`, `zsh`, `shellscript` e
// companhia já vêm resolvidos pelo próprio shiki. Estes dois aparecem em fence de
// conversa mas não são nome de linguagem em lugar nenhum.
const ALIAS: Record<string, string> = { console: 'bash', 'shell-session': 'bash' };

// Uma única promessa do highlighter: as gramáticas são importadas LAZY (chunk
// separado, fora do bundle inicial) e reusadas entre blocos.
//
// A lista é explícita de propósito. `import('shiki')` traz o bundle completo, e como
// ele resolve gramática por NOME em runtime o Vite precisa emitir um chunk por
// linguagem possível — eram 305 arquivos e ~8,7 MB de dist (emacs-lisp, wolfram e
// angular-ts inclusos) pro punhado de linguagens que um chat de código usa. Pelo
// mesmo motivo os imports abaixo são literais: montar o especificador com template
// string faria o Vite voltar a emitir a pasta inteira.
let hlPromise: Promise<HighlighterCore> | null = null;
function highlighter(): Promise<HighlighterCore> {
  if (!hlPromise) {
    hlPromise = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
        import('shiki/core'),
        import('shiki/engine/javascript'),
      ]);
      return createHighlighterCore({
        themes: [import('shiki/themes/github-dark.mjs')],
        langs: [
          import('shiki/langs/typescript.mjs'),
          import('shiki/langs/tsx.mjs'),
          import('shiki/langs/javascript.mjs'),
          import('shiki/langs/jsx.mjs'),
          import('shiki/langs/json.mjs'),
          import('shiki/langs/jsonc.mjs'),
          import('shiki/langs/bash.mjs'),
          import('shiki/langs/python.mjs'),
          import('shiki/langs/sql.mjs'),
          import('shiki/langs/html.mjs'),
          import('shiki/langs/css.mjs'),
          import('shiki/langs/markdown.mjs'),
          import('shiki/langs/yaml.mjs'),
          import('shiki/langs/toml.mjs'),
          import('shiki/langs/ini.mjs'),
          import('shiki/langs/diff.mjs'),
          import('shiki/langs/go.mjs'),
          import('shiki/langs/rust.mjs'),
          import('shiki/langs/docker.mjs'),
          import('shiki/langs/xml.mjs'),
        ],
        // Engine em JS puro: o de oniguruma arrastava um .wasm de 608 KB só pra
        // rodar as mesmas regex. `forgiving` faz a gramática que use construção não
        // suportada degradar o token em vez de derrubar o realce do bloco inteiro.
        engine: createJavaScriptRegexEngine({ forgiving: true }),
      });
    })();
  }
  return hlPromise;
}

async function tokenize(code: string, lang: string): Promise<ShToken[][] | null> {
  try {
    const hl = await highlighter();
    const norm = (lang || '').toLowerCase();
    const alias = ALIAS[norm] ?? norm;
    // Fora da lista (fence sem linguagem, ou exótica) cai em 'text' — especial do
    // shiki, sempre disponível e sem gramática pra carregar.
    const resolved = alias && hl.getLoadedLanguages().includes(alias) ? alias : 'text';
    const { tokens } = hl.codeToTokens(code, { lang: resolved, theme: THEME });
    return tokens;
  } catch {
    return null;
  }
}

// Realce de sintaxe REAL via shiki (tema github-dark), carregado sob demanda.
// Enquanto o highlighter carrega (1ª vez) ou se falhar/offline, retorna null e o
// CodeBlock cai no texto puro — sem flash nem erro. Re-tokeniza só quando (code,
// lang) mudam; no streaming cada delta troca o code e o efeito é cancelável, então
// não bloqueia o render. Mantém os tokens anteriores enquanto os novos chegam pra
// não piscar de colorido → texto puro → colorido a cada delta.
export function useShikiTokens(code: string, lang?: string): ShToken[][] | null {
  const [tokens, setTokens] = useState<ShToken[][] | null>(null);
  useEffect(() => {
    let alive = true;
    tokenize(code, lang || '').then((t) => { if (alive && t) setTokens(t); });
    return () => { alive = false; };
  }, [code, lang]);
  return tokens;
}
