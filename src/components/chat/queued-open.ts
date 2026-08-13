// Remapeia o estado "expandido" (keyed por índice) quando a fila muda: cancelar,
// drenar o topo ou reordenar deslocam os índices, e sem remap a expansão "pulava"
// pro item vizinho. Casa cada item expandido com a primeira ocorrência ainda não
// usada do mesmo texto na fila nova (duplicatas são idênticas — empate inofensivo).
export function remapOpen(prev: string[], next: string[], open: Record<number, boolean>): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  const used = new Set<number>();
  for (let i = 0; i < prev.length; i++) {
    if (!open[i]) continue;
    const j = next.findIndex((t, k) => t === prev[i] && !used.has(k));
    if (j === -1) continue;
    used.add(j);
    out[j] = true;
  }
  return out;
}

// Mesma régua pra um estado que aponta pra UM item só (edição, disparo avulso):
// devolve o índice novo do item, ou null se ele saiu da fila.
export function remapIndex(prev: string[], next: string[], i: number | null): number | null {
  if (i === null) return null;
  const [k] = Object.keys(remapOpen(prev, next, { [i]: true }));
  return k === undefined ? null : Number(k);
}
