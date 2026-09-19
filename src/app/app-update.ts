export interface BuildManifest {
  entry: string | null;
  sha256: string;
  builtAt: number;
}

// Entry que ESTA página carregou. O Vite escreve uma única tag <script type="module">
// apontando pro bundle com hash de conteúdo no nome; ler do DOM dá a identidade exata
// do código em execução, sem depender de nada injetado em tempo de build.
export function loadedEntry(doc: Document = document): string | null {
  const el = doc.querySelector('script[type="module"][src^="/assets/"]');
  return el?.getAttribute('src') ?? null;
}

// Só há atualização quando os dois lados se conhecem E divergem. Um `mine` nulo é o
// dev server (index.html sem bundle): ficar oferecendo reload ali seria um loop. Um
// `entry` nulo do servidor é build ausente, não versão nova.
export function hasUpdate(mine: string | null, served: BuildManifest | null): boolean {
  if (!mine || !served?.entry) return false;
  return served.entry !== mine;
}

// Mesma origem, sempre: o manifesto diz qual código rodar em seguida, então aceitá-lo
// de outro host deixaria um terceiro decidir isso. `location.origin` + caminho
// absoluto não dá margem, e `no-store` impede o Safari de devolver o manifesto velho
// (que é exatamente o bug que este endpoint existe pra matar).
export async function fetchBuild(signal?: AbortSignal): Promise<BuildManifest | null> {
  try {
    const res = await fetch(`${location.origin}/api/build`, { cache: 'no-store', credentials: 'omit', signal });
    if (!res.ok) return null;
    const body = (await res.json()) as BuildManifest;
    return typeof body?.entry === 'string' || body?.entry === null ? body : null;
  } catch {
    return null;
  }
}
