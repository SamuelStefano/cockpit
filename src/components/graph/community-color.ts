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
