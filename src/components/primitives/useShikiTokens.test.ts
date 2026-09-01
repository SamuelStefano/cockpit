import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Comentário fora: o arquivo EXPLICA em prosa o que não pode aparecer em código
// ("`import('shiki')` traz o bundle completo"), e sem isto o guard acusava a
// própria explicação. `:` antes de `//` preserva URL em string.
const src = readFileSync(join(__dirname, 'useShikiTokens.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

// Guarda de BUILD, não de runtime: as duas regressões abaixo não quebram nada em
// teste nem no navegador — só voltam a inchar o dist em ~9 MB, calado, e ninguém
// olha `ls dist/assets` toda PR.
describe('useShikiTokens: montagem fine-grained do shiki', () => {
  it('não importa o bundle cheio do shiki', () => {
    // `import('shiki')` traz `bundledLanguages`, um registro nome→gramática
    // resolvido em runtime. O Vite não sabe qual nome vai ser usado, então emite
    // um chunk por linguagem possível: 305 arquivos, ~8,7 MB.
    expect(src).not.toMatch(/from ['"]shiki['"]/);
    expect(src).not.toMatch(/import\(\s*['"]shiki['"]\s*\)/);
    expect(src).not.toMatch(/bundledLanguages/);
  });

  it('usa só especificador literal nos imports de gramática', () => {
    const dinamicos = [...src.matchAll(/import\(\s*([^)]*?)\s*\)/g)].map((m) => m[1]);
    expect(dinamicos.length).toBeGreaterThan(0);
    for (const arg of dinamicos) {
      // Template string ou concatenação faz o Vite tratar como glob e voltar a
      // emitir a pasta shiki/langs inteira.
      expect(arg).toMatch(/^'[^']+'$|^"[^"]+"$/);
    }
  });

  it('usa a engine de regex em JS, não a de oniguruma', () => {
    // A de oniguruma arrasta um .wasm de 608 KB pra rodar as mesmas regex.
    expect(src).toMatch(/createJavaScriptRegexEngine/);
    expect(src).not.toMatch(/createOnigurumaEngine|shiki\/wasm/);
  });
});
