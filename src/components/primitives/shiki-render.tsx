import type { ReactNode } from 'react';
import type { ShToken } from './useShikiTokens';

// Converte o bitmask de fontStyle do shiki (1 itálico, 2 negrito, 4 sublinhado)
// no estilo inline do span. Compartilhado entre o CodeBlock e o CodeEditor pra o
// realce ser idêntico no bloco estático e no editor ao vivo.
function tokenStyle(t: ShToken) {
  const fs = t.fontStyle ?? 0;
  return {
    color: t.color,
    fontStyle: fs & 1 ? 'italic' : undefined,
    fontWeight: fs & 2 ? 600 : undefined,
    textDecoration: fs & 4 ? 'underline' : undefined,
  } as const;
}

export function renderTokens(lines: ShToken[][]): ReactNode[] {
  return lines.map((line, i) => (
    <div key={i}>
      {line.length
        ? line.map((t, j) => <span key={j} style={tokenStyle(t)}>{t.content}</span>)
        : ' '}
    </div>
  ));
}
