// No modo -p o CLI não tem prompt interativo: negação de permissão chega como
// tool_result de erro com este texto fixo. Detectar permite orientar o usuário
// a trocar de modo em vez de mostrar só um "exit 1" genérico.
const DENIAL_RE = /Claude requested permissions to use (.+?), but you haven't granted it/;

export function permissionDeniedTool(output: string[]): string | null {
  for (const line of output) {
    const m = DENIAL_RE.exec(line);
    if (m) return m[1];
  }
  return null;
}
