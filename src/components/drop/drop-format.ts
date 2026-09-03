// Tamanho de drop é byte a kilobyte (um .env, uma chave, um script), escala que o
// fmtBytes da StatusBar (G/M) arredondaria pra "0M".
export function fmtDropBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '0 B';
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// sha256 curto: o suficiente pra conferir a olho contra um `sha256sum` sem ocupar
// a linha inteira com 64 hexas.
export function shortSha(sha: string): string {
  return typeof sha === 'string' ? sha.slice(0, 12) : '';
}

// Nome de arquivo → slug aceito pelo backend (/^[a-zA-Z0-9._-]{1,64}$/, sem ponto
// inicial). Preenche o campo de nome ao escolher um arquivo.
export function slugFromName(name: string): string {
  const s = (name.split(/[/\\]/).pop() ?? '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^[.]+/, '').slice(0, 64);
  return s || 'drop';
}
