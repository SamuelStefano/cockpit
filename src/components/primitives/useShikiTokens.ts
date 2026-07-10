import { useEffect, useState } from 'react';
import type { BundledLanguage, SpecialLanguage } from 'shiki';

export interface ShToken {
  content: string;
  color?: string;
  fontStyle?: number; // bitmask do shiki: 1 itálico, 2 negrito, 4 sublinhado
}

const THEME = 'github-dark';
const SHELL_ALIAS: Record<string, string> = {
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  'shell-session': 'bash', shellscript: 'bash',
};

// Uma única promessa do módulo: shiki é importado LAZY (dynamic import → chunk
// separado, fora do bundle inicial) e o singleton interno do shiki reusa as
// gramáticas já carregadas entre blocos.
let modPromise: Promise<typeof import('shiki')> | null = null;
function shikiMod() {
  if (!modPromise) modPromise = import('shiki');
  return modPromise;
}

async function tokenize(code: string, lang: string): Promise<ShToken[][] | null> {
  try {
    const shiki = await shikiMod();
    const norm = (lang || '').toLowerCase();
    const alias = SHELL_ALIAS[norm] ?? norm;
    // Lang desconhecida (fence sem linguagem ou exótica) cai em 'text' — sempre
    // disponível no shiki e sem gramática pra baixar.
    const resolved: BundledLanguage | SpecialLanguage = alias && alias in shiki.bundledLanguages ? (alias as BundledLanguage) : 'text';
    const { tokens } = await shiki.codeToTokens(code, { lang: resolved, theme: THEME });
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
