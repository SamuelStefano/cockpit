// iOS Safari com <input multiple> + fototeca às vezes entrega o MESMO arquivo
// repetido no FileList (ou re-dispara o change), virando 4 anexos idênticos de uma
// foto só. Deduplica por assinatura (nome+tamanho+data) dentro de uma janela curta —
// cobre tanto o FileList repetido quanto re-disparos em sequência.

type FileLike = { name: string; size: number; lastModified: number };

export function fileSig(f: FileLike): string {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

// Retorna só os arquivos novos na janela e marca os aceitos em `seen` (com prune das
// entradas vencidas pra o mapa não crescer sem fim).
export function pickFreshUploads<T extends FileLike>(
  files: T[],
  seen: Map<string, number>,
  now: number,
  windowMs = 3000,
): T[] {
  for (const [k, t] of seen) if (now - t >= windowMs) seen.delete(k);
  const out: T[] = [];
  for (const f of files) {
    const sig = fileSig(f);
    const last = seen.get(sig);
    if (last !== undefined && now - last < windowMs) continue;
    seen.set(sig, now);
    out.push(f);
  }
  return out;
}
