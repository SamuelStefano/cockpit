import { transform } from 'sucrase';

export type TranspileResult = { code: string } | { error: string };

// Transpila o componente TSX/JSX de arquivo único do assistente para JS plano
// com sucrase (dep direta). O transform `imports` reescreve `export default` e
// `import ... from 'react'` em CommonJS, pra o iframe pegar via module.exports /
// require. Devolve erro como string em vez de lançar — o preview degrada num
// aviso amigável no lugar de quebrar a renderização do chat.
export function transpile(source: string): TranspileResult {
  try {
    const { code } = transform(source, {
      transforms: ['typescript', 'jsx', 'imports'],
      production: true,
    });
    return { code };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
