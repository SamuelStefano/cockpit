// Libs pesadas e estáveis em chunks próprios: o bundle do app, que muda a cada
// deploy, deixa de invalidar o cache do vendor.
//
// Separa o ARQUIVO, não o CARREGAMENTO: se algo no grafo estático do entry importa
// a lib, o Vite emite `modulepreload` e o browser baixa o chunk em toda visita do
// mesmo jeito. Quem tira do caminho crítico é o import dinâmico — por isso o xterm
// só sai do preload de fato por causa do `lazy()` em Terminals.tsx.
//
// Casa por PACOTE, não por especificador: a forma de objeto do manualChunks (que o
// rolldown do Vite 8 não aceita mais) casava o que o import escrevia, então
// `react-dom/client` precisava estar listado à parte de `react-dom` e sumiu do
// chunk quando o React 19 separou as entradas. Pelo caminho do arquivo isso não
// acontece: subcaminho e entrada raiz do mesmo pacote caem no mesmo lugar.

const VENDOR: Record<string, string> = {
  react: 'react',
  'react-dom': 'react',
  scheduler: 'react',
  '@xterm/': 'xterm',
  sucrase: 'sucrase',
  '@supabase/': 'supabase',
};

// O pacote é o que vem depois do ÚLTIMO `node_modules/`: dependência aninhada mora
// em `node_modules/a/node_modules/b`, e casar o primeiro daria o pacote de fora.
export function packageOf(id: string): string | null {
  const at = id.lastIndexOf('node_modules/');
  if (at < 0) return null;
  const rest = id.slice(at + 'node_modules/'.length);
  const parts = rest.split('/');
  const name = parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1] ?? ''}` : parts[0];
  return name || null;
}

export function vendorChunk(id: string): string | undefined {
  const pkg = packageOf(id);
  if (!pkg) return undefined;
  const scope = pkg.includes('/') ? `${pkg.split('/')[0]}/` : null;
  return VENDOR[pkg] ?? (scope ? VENDOR[scope] : undefined);
}
