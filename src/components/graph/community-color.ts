// Cor determinística por comunidade. Ângulo áureo espalha os matizes de forma
// que comunidades vizinhas em id não colidam de cor. Saturação/luminância fixas
// pro fundo escuro do Deck (contraste legível, nada estourado).
const GOLDEN = 137.508;

export function communityHue(community: number): number {
  return ((community * GOLDEN) % 360 + 360) % 360;
}

export function communityColor(community: number, alpha = 1): string {
  const h = communityHue(community);
  return alpha >= 1 ? `hsl(${h.toFixed(1)}, 62%, 60%)` : `hsla(${h.toFixed(1)}, 62%, 60%, ${alpha})`;
}

// Cor determinística por REPO (nome do app). No grafo global cada app vira um
// cluster de cor própria — muito mais legível que colorir por comunidade (que
// só faz sentido dentro de um repo). FNV-1a → matiz estável por nome.
export function repoHue(repo: string): number {
  let h = 2166136261;
  for (let i = 0; i < repo.length; i++) { h ^= repo.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}

export function repoColor(repo: string, alpha = 1): string {
  const h = repoHue(repo);
  return alpha >= 1 ? `hsl(${h}, 65%, 58%)` : `hsla(${h}, 65%, 58%, ${alpha})`;
}
