import { spawn } from 'node:child_process';
import { readdir, readFile, stat, rm, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { GraphData, GraphMeta, GraphNode, GraphEdge } from '../shared/protocol';

// Feature "graph": expõe o graphify (knowledge graph via tree-sitter AST, 100%
// local) como uma rota do cockpit. O backend só ORQUESTRA o binário do graphify —
// não reimplementa nada. Cada grafo construído vive em GRAPHS_DIR/<id>/graphify-out/.
//
// Segurança: o build/query spawnam um binário com ARGS EM ARRAY (nunca shell
// string) — sem injeção. id é slug allow-listado; o repo de build é resolvido a
// caminho absoluto e precisa ser um diretório existente. build/delete são
// admin-only no authz (spawn de processo + escrita); list/open/query idem, já que
// o grafo revela a estrutura do código.

const GRAPHS_DIR = process.env.COCKPIT_GRAPHS_DIR ?? join(homedir(), '.cockpit', 'graphs');
const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;

// "global" é um id reservado: não é uma pasta em GRAPHS_DIR, é o merge de TODOS
// os grafos via `graphify global add` (~/.graphify/global-graph.json). Cada
// build bem-sucedido se auto-registra nele (ver buildGraph), então a view
// "todos os apps" fica sempre atualizada sem passo manual.
const GLOBAL_ID = 'global';
function globalGraphPath(): string { return join(homedir(), '.graphify', 'global-graph.json'); }

// Extensões que o detector do graphify trata como "doc"/"paper"/"image" e que
// exigiriam uma LLM key (extração semântica). Excluí-las mantém o build 100%
// local/AST/sem custo — cobre tanto docs (md/yaml/…) quanto assets estáticos
// (favicon, logo) que apareceriam como "imagem" e travariam o build sem key.
const DOC_EXCLUDES = [
  '*.md', '*.mdx', '*.yaml', '*.yml', '*.html', '*.txt', '*.rst',
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.svg', '*.pdf',
];
const MAX_WIRE_NODES = 4000; // teto do payload de viz (grafos gigantes não estouram o frame do relay)
const MAX_WIRE_EDGES = 9000;

// Resolve o binário do graphify: env explícito > venv do estudo > PATH. Sem
// binário → as funções retornam erro claro em vez de quebrar o backend.
function graphifyBin(): string {
  const envBin = process.env.COCKPIT_GRAPHIFY_BIN;
  if (envBin && existsSync(envBin)) return envBin;
  const venvBin = join(homedir(), 'graphify-study', '.venv', 'bin', 'graphify');
  if (existsSync(venvBin)) return venvBin;
  return 'graphify';
}

function graphDir(id: string): string { return join(GRAPHS_DIR, id); }
function graphJsonPath(id: string): string { return join(graphDir(id), 'graphify-out', 'graph.json'); }

async function isFile(p: string): Promise<boolean> {
  try { return (await stat(p)).isFile(); } catch { return false; }
}
async function isDir(p: string): Promise<boolean> {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

// Roda o graphify e resolve com {code, out} agregando stdout+stderr. onLine
// recebe cada linha de progresso (o graphify loga o avanço da extração no stdout).
function runGraphify(args: string[], onLine?: (line: string) => void): Promise<{ code: number; out: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(graphifyBin(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let buf = '';
    const onChunk = (chunk: Buffer) => {
      const s = chunk.toString();
      out += s;
      if (out.length > 512 * 1024) out = out.slice(-512 * 1024); // teto de memória
      if (!onLine) return;
      buf += s;
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) onLine(line);
      }
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('error', (e) => resolvePromise({ code: -1, out: `${out}\n${(e as Error).message}` }));
    child.on('close', (code) => {
      if (buf.trim() && onLine) onLine(buf.trim());
      resolvePromise({ code: code ?? -1, out });
    });
  });
}

// Lê um graph.json (formato node-link do networkx) por PATH direto e projeta só
// o que a viz usa, com teto de nós/arestas pra bounded payload. `repo` (presente
// só no merge global) vira campo no nó pra a UI distinguir de qual app é cada um.
async function loadGraphDataFromPath(p: string): Promise<GraphData | null> {
  if (!(await isFile(p))) return null;
  let raw: string;
  try { raw = await readFile(p, 'utf8'); } catch { return null; }
  let g: { nodes?: unknown[]; links?: unknown[]; directed?: boolean };
  try { g = JSON.parse(raw); } catch { return null; }
  const rawNodes = Array.isArray(g.nodes) ? g.nodes : [];
  const rawLinks = Array.isArray(g.links) ? g.links : [];

  const deg = new Map<string, number>();
  for (const l of rawLinks as Record<string, unknown>[]) {
    const s = String(l.source ?? ''); const t = String(l.target ?? '');
    deg.set(s, (deg.get(s) ?? 0) + 1);
    deg.set(t, (deg.get(t) ?? 0) + 1);
  }

  let nodes: GraphNode[] = (rawNodes as Record<string, unknown>[]).map((n) => ({
    id: String(n.id ?? ''),
    label: String(n.label ?? n.norm_label ?? n.id ?? ''),
    community: typeof n.community === 'number' ? n.community : 0,
    communityName: typeof n.community_name === 'string' ? n.community_name : undefined,
    file: typeof n.source_file === 'string' ? n.source_file : undefined,
    loc: typeof n.source_location === 'string' ? n.source_location : undefined,
    fileType: typeof n.file_type === 'string' ? n.file_type : undefined,
    repo: typeof n.repo === 'string' ? n.repo : undefined,
    deg: deg.get(String(n.id ?? '')) ?? 0,
  })).filter((n) => n.id);

  if (nodes.length > MAX_WIRE_NODES) {
    nodes = [...nodes].sort((a, b) => b.deg - a.deg).slice(0, MAX_WIRE_NODES);
  }
  const keep = new Set(nodes.map((n) => n.id));

  let edges: GraphEdge[] = (rawLinks as Record<string, unknown>[])
    .map((l) => ({
      source: String(l.source ?? ''),
      target: String(l.target ?? ''),
      relation: typeof l.relation === 'string' ? l.relation : 'related',
      confidence: l.confidence === 'INFERRED' ? 'INFERRED' as const : 'EXTRACTED' as const,
    }))
    .filter((e) => keep.has(e.source) && keep.has(e.target));
  if (edges.length > MAX_WIRE_EDGES) edges = edges.slice(0, MAX_WIRE_EDGES);

  const communities = new Map<number, string>();
  for (const n of nodes) if (!communities.has(n.community)) communities.set(n.community, n.communityName ?? `Community ${n.community}`);

  return {
    directed: !!g.directed,
    nodes,
    edges,
    communities: [...communities.entries()].map(([id, name]) => ({ id, name })),
    truncated: rawNodes.length > nodes.length,
    totalNodes: rawNodes.length,
    totalEdges: rawLinks.length,
  };
}

async function countNodesEdges(p: string): Promise<{ nodes: number; edges: number; mtime: number } | null> {
  try {
    const st = await stat(p);
    // Conta nós/arestas sem carregar o JSON inteiro na memória duas vezes: um
    // parse leve (o arquivo já está no page cache pós-build).
    const g = JSON.parse(await readFile(p, 'utf8')) as { nodes?: unknown[]; links?: unknown[] };
    return {
      nodes: Array.isArray(g.nodes) ? g.nodes.length : 0,
      edges: Array.isArray(g.links) ? g.links.length : 0,
      mtime: st.mtimeMs,
    };
  } catch { return null; }
}

export async function listGraphs(): Promise<GraphMeta[]> {
  let entries: import('node:fs').Dirent[] = [];
  try { entries = await readdir(GRAPHS_DIR, { withFileTypes: true }); } catch { /* ainda sem grafos */ }
  const metas: GraphMeta[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !SLUG_RE.test(e.name)) continue;
    const counts = await countNodesEdges(graphJsonPath(e.name));
    if (!counts) continue;
    metas.push({ id: e.name, label: e.name.replace(/[-_]/g, ' '), ...counts });
  }
  metas.sort((a, b) => b.mtime - a.mtime);
  // "global" (todos os apps mesclados) sempre no topo quando existe — é a view
  // de maior alavancagem pra economia de tokens (uma pergunta cruza N repos).
  const globalCounts = await countNodesEdges(globalGraphPath());
  if (globalCounts) metas.unshift({ id: GLOBAL_ID, label: 'todos os apps', ...globalCounts });
  return metas;
}

export async function readGraph(id: string): Promise<GraphData | null> {
  if (id === GLOBAL_ID) return loadGraphDataFromPath(globalGraphPath());
  if (!SLUG_RE.test(id)) return null;
  return loadGraphDataFromPath(graphJsonPath(id));
}

export interface BuildResult { ok: boolean; id?: string; error?: string }

// Constrói um grafo pra o repo em `repo`. Valida caminho, deriva um id-slug do
// basename, spawna o graphify (code-only), e resolve quando o graph.json existe.
export async function buildGraph(repo: string, onLine?: (line: string) => void): Promise<BuildResult> {
  const abs = resolve(repo.replace(/^~(?=$|\/)/, homedir()));
  if (!(await isDir(abs))) return { ok: false, error: `caminho não é um diretório: ${abs}` };
  const slug = basename(abs).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'repo';
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'nome de repo inválido' };
  const outDir = graphDir(slug);
  try { await rm(outDir, { recursive: true, force: true }); } catch { /* primeira vez */ }
  const excludes = DOC_EXCLUDES.flatMap((g) => ['--exclude', g]);
  const args = [abs, ...excludes, '--out', outDir];
  onLine?.(`graphify ${args.join(' ')}`);
  const { code } = await runGraphify(args, onLine);
  if (!(await isFile(graphJsonPath(slug)))) {
    return { ok: false, error: code === 0 ? 'build terminou sem gerar graph.json' : `graphify saiu com código ${code}` };
  }
  // Auto-registra no grafo global (merge de todos os apps) — best-effort: se
  // falhar, o grafo individual do repo continua válido, só a view "todos os
  // apps" fica um passo atrás até o próximo build.
  onLine?.(`graphify global add ${slug}`);
  await runGraphify(['global', 'add', graphJsonPath(slug), '--as', slug], onLine);
  return { ok: true, id: slug };
}

export async function deleteGraph(id: string): Promise<boolean> {
  if (id === GLOBAL_ID) return false; // derivado — se apaga sozinho quando o último repo sai
  if (!SLUG_RE.test(id)) return false;
  try {
    await rm(graphDir(id), { recursive: true, force: true });
    await runGraphify(['global', 'remove', id]);
    return true;
  } catch { return false; }
}

export interface QueryResult { answer: string; tokens: number }

// Roda `graphify query` contra o grafo. Retorna o subgrafo escopado (texto) e uma
// estimativa de tokens (chars/4) — a UI mostra o "custo" da resposta pro contraste
// com ler os arquivos crus.
export async function queryGraph(id: string, question: string): Promise<QueryResult | null> {
  const p = id === GLOBAL_ID ? globalGraphPath() : (SLUG_RE.test(id) ? graphJsonPath(id) : null);
  if (!p || !(await isFile(p))) return null;
  const q = question.trim().slice(0, 500);
  if (!q) return { answer: '', tokens: 0 };
  const { out } = await runGraphify(['query', q, '--graph', p, '--budget', '2000']);
  const answer = out.trim().slice(0, 40_000);
  return { answer, tokens: Math.round(answer.length / 4) };
}

export { GRAPHS_DIR, GLOBAL_ID };
