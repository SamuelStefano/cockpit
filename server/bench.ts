import { build as esbuild, type Plugin } from 'esbuild';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BENCH_SLUG_RE } from '../shared/bench';

const run = promisify(execFile);

// Compila um componente de OUTRO repo num bundle autocontido, pra rodar dentro do
// iframe de origem opaca do chat. É o que permite mexer na UI de uma PR ao vivo
// sem subir o dev server do repo alvo — nada de proxy, porta nova ou SSRF: o
// bundle viaja pelo WS que já existe, que é o único canal presente em todo deploy.

export interface BenchTarget {
  root: string;
  /** Prefixo de import → diretório, relativo à raiz (ex.: `{"@": "src"}`). */
  alias?: Record<string, string>;
  /** Entrada de CSS do repo (Tailwind) — compilada com o tema do alvo. */
  css?: string;
  /** Globs de conteúdo pro Tailwind varrer classes. Relativos à raiz. */
  content?: string[];
}

export interface BenchResult {
  ok: boolean;
  js?: string;
  css?: string;
  ms?: number;
  error?: string;
}

const REGISTRY = join(homedir(), '.cockpit', 'bench.json');
const MAX_CODE = 128 * 1024;
const MAX_BUNDLE = 8 * 1024 * 1024;
const CSS_TTL_MS = 60_000;

const cssCache = new Map<string, { css: string; at: number }>();
// Um build por vez. Cada um é um esbuild + um Tailwind sobre um app inteiro; N
// cercas numa mensagem disparariam N em paralelo e derrubariam a box por memória.
let queue: Promise<unknown> = Promise.resolve();

async function readRegistry(): Promise<Record<string, BenchTarget>> {
  try {
    const raw = JSON.parse(await readFile(REGISTRY, 'utf8')) as Record<string, BenchTarget>;
    const out: Record<string, BenchTarget> = {};
    for (const [slug, t] of Object.entries(raw)) {
      if (BENCH_SLUG_RE.test(slug) && t && typeof t.root === 'string' && existsSync(t.root)) out[slug] = t;
    }
    return out;
  } catch {
    return {};
  }
}

// O alvo NUNCA vem do cliente como caminho: o cliente manda um slug e o servidor
// resolve pelo registro em disco. Caminho vindo do cliente seria SSRF/leitura
// arbitrária de arquivo com verniz de feature.
async function resolveTarget(slug: string): Promise<BenchTarget | null> {
  if (!BENCH_SLUG_RE.test(slug)) return null;
  return (await readRegistry())[slug] ?? null;
}

// Trava a resolução dentro do repo alvo. Sem isso um `import x from
// '/home/samuel/.claude.json'` seria inlinado no bundle (esbuild carrega .json
// nativamente) e entregue ao browser — exfiltração de segredo via import.
export function insideRoot(root: string, p: string): boolean {
  return resolve(p).startsWith(resolve(root) + sep);
}

// A trava é no onLoad, não no onResolve: aqui o caminho JÁ está resolvido, então
// não precisamos reentrar no resolvedor (b.resolve por import estoura o serviço
// do esbuild num repo do tamanho de um app real).
function confine(root: string): Plugin {
  return {
    name: 'bench-confine',
    setup(b) {
      b.onLoad({ filter: /.*/ }, (args) => {
        if (args.namespace !== 'file' || insideRoot(root, args.path)) return null;
        return { errors: [{ text: `fora do repo do bench: ${args.path}` }] };
      });
    },
  };
}

// O código do usuário entra como módulo virtual: nada é escrito no repo alvo, e
// o repo continua limpo mesmo com o bench rodando em cima de uma branch de PR.
// O entry real é um shim fixo que monta o `export default` do usuário — assim o
// bundle é autossuficiente (traz o próprio React) e o iframe não precisa de UMD.
const MOUNT = [
  "import React from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import App from 'bench-user';",
  "createRoot(document.getElementById('root')).render(React.createElement(App));",
].join('\n');

function virtualEntry(code: string, root: string): Plugin {
  return {
    name: 'bench-entry',
    setup(b) {
      b.onResolve({ filter: /^bench-(entry|user)$/ }, (a) => ({ path: a.path, namespace: 'bench' }));
      b.onLoad({ filter: /.*/, namespace: 'bench' }, (a) => ({
        contents: a.path === 'bench-entry' ? MOUNT : code,
        loader: 'tsx',
        resolveDir: join(root, 'src'),
      }));
    },
  };
}

export function buildBench(slug: string, code: string): Promise<BenchResult> {
  const next = queue.then(() => runBuild(slug, code));
  queue = next.catch(() => undefined);
  return next;
}

async function runBuild(slug: string, code: string): Promise<BenchResult> {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, error: 'sem código' };
  if (code.length > MAX_CODE) return { ok: false, error: `código acima de ${MAX_CODE / 1024}KB` };
  const target = await resolveTarget(slug);
  if (!target) return { ok: false, error: `alvo desconhecido: ${slug}` };

  const root = resolve(target.root);
  const started = Date.now();
  try {
    const alias: Record<string, string> = {};
    for (const [k, v] of Object.entries(target.alias ?? {})) alias[k] = join(root, v);

    const out = await esbuild({
      entryPoints: ['bench-entry'],
      bundle: true,
      write: false,
      // Sem outfile o esbuild nomeia a saída de `<stdout>` e o CSS importado pelos
      // componentes não sai em arquivo próprio — é só rótulo, nada toca o disco.
      outfile: 'bench.js',
      format: 'iife',
      absWorkingDir: root,
      nodePaths: [join(root, 'node_modules')],
      alias,
      plugins: [virtualEntry(code, root), confine(root)],
      loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl', '.gif': 'dataurl', '.woff2': 'dataurl', '.css': 'css' },
      define: { 'process.env.NODE_ENV': '"production"' },
      jsx: 'automatic',
      minify: true,
      logLevel: 'silent',
    });

    const js = out.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
    if (js.length > MAX_BUNDLE) return { ok: false, error: 'bundle grande demais' };
    const bundled = out.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n');
    const css = [await themeCss(slug, target, root), bundled].filter(Boolean).join('\n');
    return { ok: true, js, css, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 4000) };
  }
}

// O CSS do tema do alvo (Tailwind) muda pouco e custa ~1s: cache curto evita
// pagar isso a cada tecla enquanto o código é editado ao vivo.
async function themeCss(slug: string, target: BenchTarget, root: string): Promise<string> {
  if (!target.css) return '';
  const hit = cssCache.get(slug);
  if (hit && Date.now() - hit.at < CSS_TTL_MS) return hit.css;
  // Binário instalado no repo alvo, NUNCA `npx`: fora de TTY o npx baixa e executa
  // pacote sem perguntar, obedecendo o .npmrc daquele repo — uma branch de PR que
  // aponte o registry pra outro lugar viraria execução de código nesta máquina.
  const bin = join(root, 'node_modules', '.bin', 'tailwindcss');
  if (!existsSync(bin)) return '';
  const content = (target.content ?? ['src/**/*.{ts,tsx}']).join(',');
  // `-o -` não escreve nada no stdout nesta versão da CLI do Tailwind; arquivo
  // temporário é o único caminho que devolve o CSS de fato.
  const dir = await mkdtemp(join(tmpdir(), 'bench-css-'));
  const out = join(dir, 'theme.css');
  try {
    await run(bin, ['-i', target.css, '-o', out, '--content', content, '--minify'], {
      cwd: root,
      timeout: 120_000,
      env: { PATH: process.env.PATH ?? '', HOME: homedir(), npm_config_ignore_scripts: 'true' },
    });
    const css = await readFile(out, 'utf8');
    cssCache.set(slug, { css, at: Date.now() });
    return css;
  } catch {
    return '';
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
