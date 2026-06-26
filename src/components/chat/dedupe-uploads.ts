// Um print colado / foto da fototeca às vezes chega repetido (mesmo FileList
// repetido, re-disparo do change/paste, ou caminhos de upload concorrentes) e vira
// vários anexos idênticos de um arquivo só. Deduplica por assinatura numa janela
// curta. A assinatura é nome+tamanho (NÃO inclui lastModified: cópias do mesmo
// arquivo podem vir com data jitterada e furariam o dedup).

type FileLike = { name: string; size: number };

export function fileSig(f: FileLike): string {
  return `${f.name}:${f.size}`;
}

// true se o arquivo é novo na janela (e marca como visto); false se é repetido.
// Faz prune das entradas vencidas pra o mapa não crescer sem fim.
export function isFreshUpload(
  seen: Map<string, number>,
  sig: string,
  now: number,
  windowMs = 3000,
): boolean {
  for (const [k, t] of seen) if (now - t >= windowMs) seen.delete(k);
  const last = seen.get(sig);
  if (last !== undefined && now - last < windowMs) return false;
  seen.set(sig, now);
  return true;
}

// Filtra uma lista de arquivos mantendo só os novos na janela.
export function pickFreshUploads<T extends FileLike>(
  files: T[],
  seen: Map<string, number>,
  now: number,
  windowMs = 3000,
): T[] {
  return files.filter((f) => isFreshUpload(seen, fileSig(f), now, windowMs));
}
