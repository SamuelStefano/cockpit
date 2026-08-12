import { spawn } from 'node:child_process';
import { readdir, readFile, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { GraphData, GraphMeta, GraphNode, GraphEdge } from '../shared/protocol';

// Feature "graph": expõe o graphify (knowledge graph via tree-sitter AST, 100%
// local) como uma rota do cockpit. O backend só ORQUESTRA o binário do graphify —
// não reimplementa nada. Cada grafo construído vive em GRAPHS_DIR/<id>/graphify-out/.
//
// Segurança: build/query spawnam o binário com ARGS EM ARRAY (nunca shell string)
// — sem injeção. id é slug allow-listado; o repo de build é resolvido a caminho
// absoluto e precisa ser um diretório existente. Tudo é admin-only no authz.

const GRAPHS_DIR = process.env.COCKPIT_GRAPHS_DIR ?? join(homedir(), '.cockpit', 'graphs');
const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;

// "global" é um id reservado: não é uma pasta em GRAPHS_DIR, é o merge de TODOS
// os grafos via `graphify global add` (~/.graphify/global-graph.json).
const GLOBAL_ID = 'global';
function globalGraphPath(): string { return join(homedir(), '.graphify', 'global-graph.json'); }

// Extensões que o detector do graphify trata como "doc"/"paper"/"image" e que
// exigiriam LLM key. Excluí-las mantém o build 100% local/AST/sem custo.
const DOC_EXCLUDES = [
  '*.md', '*.mdx', '*.yaml', '*.yml', '*.html', '*.txt', '*.rst',
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.webp', '*.svg', '*.pdf',
];
const MAX_WIRE_NODES = 4000; // teto do payload de viz (grafos gigantes não estouram o frame do relay)
const MAX_WIRE_EDGES = 9000;
const MISS_MARKER = 'No matching nodes found';

function graphifyBin(): string {
  const envBin = process.env.COCKPIT_GRAPHIFY_BIN;
  if (envBin && existsSync(envBin)) return envBin;
  const venvBin = join(homedir(), 'graphify-study', '.venv', 'bin', 'graphify');
  if (existsSync(venvBin)) return venvBin;
  return 'graphify';
}

function graphDir(id: string): string { return join(GRAPHS_DIR, id); }
function graphJsonPath(id: string): string { return join(graphDir(id), 'graphify-out', 'graph.json'); }
function benchmarkPath(id: string): string { return join(graphDir(id), 'graphify-out', 'benchmark.json'); }
// Resolve o graph.json de um id (global tem path próprio; repo valida slug).
function pathFor(id: string): string | null {
  if (id === GLOBAL_ID) return globalGraphPath();
  return SLUG_RE.test(id) ? graphJsonPath(id) : null;
}

// Arg de usuário que começa com '-' viraria FLAG do binário graphify: args em array
// barram o shell, mas NÃO o parser de flags do próprio binário. Rejeita esse caso.
export function rejectFlagLike(s: string): boolean {
  return s.startsWith('-');
}

async function isFile(p: string): Promise<boolean> {
  try { return (await stat(p)).isFile(); } catch { return false; }
}
async function isDir(p: string): Promise<boolean> {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

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

// ---------------------------------------------------------------------------
// Projeção pura (testável, sem FS): raw node-link do networkx -> GraphData.
// ---------------------------------------------------------------------------

// Nome legível de uma comunidade a partir dos seus nós: diretório dominante
// (2 primeiros segmentos de um caminho relativo), com prefixo do repo dominante
// no grafo global. Empate → o alfabeticamente menor. Sem arquivos → '' (o caller
// cai em "comunidade N"). Puro e determinístico.
export function nameCommunity(members: GraphNode[]): string {
  const top = (values: (string | undefined)[]): string => {
    const counts = new Map<string, number>();
    for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = ''; let bestN = 0;
    for (const [v, n] of counts) if (n > bestN || (n === bestN && (best === '' || v < best))) { best = v; bestN = n; }
    return best;
  };
  const dirOf = (file?: string): string | undefined => {
    if (!file || file.startsWith('/')) return undefined; // absoluto (cross-repo) não ajuda a nomear
    const segs = file.split('/').filter(Boolean);
    segs.pop(); // tira o nome do arquivo — queremos o diretório
    return segs.length ? segs.slice(0, 2).join('/') : undefined; // arquivo na raiz do repo não nomeia
  };
  const dir = top(members.map((m) => dirOf(m.file)));
  const repo = top(members.map((m) => m.repo));
  if (!dir) return repo || '';
  return repo ? `${repo} · ${dir}` : dir;
}

export function projectGraph(parsed: unknown): GraphData {
  const g = (parsed ?? {}) as { nodes?: unknown[]; links?: unknown[]; directed?: boolean };
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

  // Corte de nós: mantém os mais conectados (o esqueleto do grafo).
  if (nodes.length > MAX_WIRE_NODES) nodes = [...nodes].sort((a, b) => b.deg - a.deg).slice(0, MAX_WIRE_NODES);
  const degOf = new Map(nodes.map((n) => [n.id, n.deg]));
  const keep = new Set(nodes.map((n) => n.id));

  let edges: GraphEdge[] = (rawLinks as Record<string, unknown>[])
    .map((l) => ({
      source: String(l.source ?? ''),
      target: String(l.target ?? ''),
      relation: typeof l.relation === 'string' ? l.relation : 'related',
      confidence: l.confidence === 'INFERRED' ? 'INFERRED' as const : 'EXTRACTED' as const,
    }))
    .filter((e) => keep.has(e.source) && keep.has(e.target));
  // Corte de arestas: por conectividade (min grau das pontas) desc — preserva o
  // esqueleto em vez de cortar na ordem arbitrária do arquivo.
  if (edges.length > MAX_WIRE_EDGES) {
    edges = [...edges]
      .sort((a, b) => Math.min(degOf.get(b.source)!, degOf.get(b.target)!) - Math.min(degOf.get(a.source)!, degOf.get(a.target)!))
      .slice(0, MAX_WIRE_EDGES);
  }

  // Nomes de comunidade: resolve placeholders "Community N" pelo diretório
  // dominante e propaga pro nó (hover/detalhe/legenda mostram algo útil).
  const byCommunity = new Map<number, GraphNode[]>();
  for (const n of nodes) (byCommunity.get(n.community) ?? byCommunity.set(n.community, []).get(n.community)!).push(n);
  const nameByCommunity = new Map<number, string>();
  for (const [cid, members] of byCommunity) {
    const raw = members.find((m) => m.communityName)?.communityName;
    const name = raw && !/^Community \d+$/i.test(raw) ? raw : (nameCommunity(members) || `comunidade ${cid}`);
    nameByCommunity.set(cid, name);
  }
  for (const n of nodes) n.communityName = nameByCommunity.get(n.community);

  return {
    directed: !!g.directed,
    nodes,
    edges,
    communities: [...nameByCommunity.entries()].map(([id, name]) => ({ id, name })),
    truncated: rawNodes.length > nodes.length,
    totalNodes: rawNodes.length,
    totalEdges: rawLinks.length,
  };
}

// ---------------------------------------------------------------------------
// Cache por mtime — evita re-parsear o global (41MB) a cada list/open.
// ---------------------------------------------------------------------------
interface CacheEntry { mtime: number; nodes: number; edges: number; data?: GraphData }
const cache = new Map<string, CacheEntry>();
const DATA_CACHE_MAX = 3; // nº de GraphData projetados retidos (LRU) — o resto guarda só counts

function evictData() {
  const withData = [...cache.entries()].filter(([, e]) => e.data);
  if (withData.length <= DATA_CACHE_MAX) return;
  // Map preserva ordem de inserção → o primeiro com data é o menos recente.
  const [oldest] = withData[0];
  const e = cache.get(oldest); if (e) delete e.data;
}

async function readAndParse(p: string): Promise<{ mtime: number; parsed: unknown } | null> {
  try {
    const st = await stat(p);
    const parsed = JSON.parse(await readFile(p, 'utf8'));
    return { mtime: st.mtimeMs, parsed };
  } catch { return null; }
}

async function loadGraphDataFromPath(p: string): Promise<GraphData | null> {
  let st;
  try { st = await stat(p); } catch { return null; }
  const hit = cache.get(p);
  if (hit && hit.mtime === st.mtimeMs && hit.data) return hit.data;
  const rp = await readAndParse(p); if (!rp) return null;
  const data = projectGraph(rp.parsed);
  const g = rp.parsed as { nodes?: unknown[]; links?: unknown[] };
  cache.set(p, { mtime: rp.mtime, nodes: Array.isArray(g.nodes) ? g.nodes.length : 0, edges: Array.isArray(g.links) ? g.links.length : 0, data });
  evictData();
  return data;
}

async function countNodesEdges(p: string): Promise<{ nodes: number; edges: number; mtime: number } | null> {
  let st;
  try { st = await stat(p); } catch { return null; }
  const hit = cache.get(p);
  if (hit && hit.mtime === st.mtimeMs) return { nodes: hit.nodes, edges: hit.edges, mtime: hit.mtime };
  const rp = await readAndParse(p); if (!rp) return null;
  const g = rp.parsed as { nodes?: unknown[]; links?: unknown[] };
  const counts = { nodes: Array.isArray(g.nodes) ? g.nodes.length : 0, edges: Array.isArray(g.links) ? g.links.length : 0, mtime: rp.mtime };
  cache.set(p, { ...counts });
  return counts;
}

async function readBenchmarkRatio(id: string): Promise<number | undefined> {
  try {
    const j = JSON.parse(await readFile(benchmarkPath(id), 'utf8')) as { ratio?: number };
    return typeof j.ratio === 'number' ? j.ratio : undefined;
  } catch { return undefined; }
}

export async function listGraphs(): Promise<GraphMeta[]> {
  let entries: import('node:fs').Dirent[] = [];
  try { entries = await readdir(GRAPHS_DIR, { withFileTypes: true }); } catch { /* ainda sem grafos */ }
  const metas: GraphMeta[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !SLUG_RE.test(e.name)) continue;
    const counts = await countNodesEdges(graphJsonPath(e.name));
    if (!counts) continue;
    metas.push({ id: e.name, label: e.name.replace(/[-_]/g, ' '), ...counts, ratio: await readBenchmarkRatio(e.name) });
  }
  metas.sort((a, b) => b.mtime - a.mtime);
  const globalCounts = await countNodesEdges(globalGraphPath());
  if (globalCounts) metas.unshift({ id: GLOBAL_ID, label: 'todos os apps', ...globalCounts });
  return metas;
}

export async function readGraph(id: string): Promise<GraphData | null> {
  const p = pathFor(id);
  return p ? loadGraphDataFromPath(p) : null;
}

export interface BuildResult { ok: boolean; id?: string; error?: string }

// Single-flight: o graphify é CPU-pesado; serializar builds é o comportamento
// correto (não uma limitação). Dois builds concorrentes no mesmo outDir dariam
// rm -rf + spawn em cima um do outro.
let buildInFlight: string | null = null;

export async function buildGraph(repo: string, onLine?: (line: string) => void): Promise<BuildResult> {
  const abs = resolve(repo.replace(/^~(?=$|\/)/, homedir()));
  if (!(await isDir(abs))) return { ok: false, error: `caminho não é um diretório: ${abs}` };
  const slug = basename(abs).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'repo';
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'nome de repo inválido' };
  if (buildInFlight) return { ok: false, error: `já existe um build em andamento (${buildInFlight})` };
  buildInFlight = slug;
  try {
    const outDir = graphDir(slug);
    try { await rm(outDir, { recursive: true, force: true }); } catch { /* primeira vez */ }
    const excludes = DOC_EXCLUDES.flatMap((g) => ['--exclude', g]);
    const args = [abs, ...excludes, '--out', outDir];
    onLine?.(`graphify ${args.join(' ')}`);
    const { code } = await runGraphify(args, onLine);
    if (!(await isFile(graphJsonPath(slug)))) {
      return { ok: false, error: code === 0 ? 'build terminou sem gerar graph.json' : `graphify saiu com código ${code}` };
    }
    onLine?.(`graphify global add ${slug}`);
    await runGraphify(['global', 'add', graphJsonPath(slug), '--as', slug], onLine);
    // Benchmark de token real (best-effort, não bloqueia o done). Grava ratio no
    // benchmark.json pro card mostrar economia honesta em vez de heurística.
    void runBenchmark(slug);
    return { ok: true, id: slug };
  } finally {
    buildInFlight = null;
  }
}

async function runBenchmark(id: string): Promise<void> {
  try {
    const { out } = await runGraphify(['benchmark', graphJsonPath(id)]);
    const m = out.match(/Reduction:\s*([\d.]+)x/i) ?? out.match(/([\d.]+)x\s*fewer/i);
    if (!m) return;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(benchmarkPath(id), JSON.stringify({ ratio: Number(m[1]), at: Date.now() }));
  } catch { /* benchmark é opcional */ }
}

export async function deleteGraph(id: string): Promise<boolean> {
  if (id === GLOBAL_ID) return false; // derivado — some quando o último repo sai
  if (!SLUG_RE.test(id)) return false;
  try {
    await rm(graphDir(id), { recursive: true, force: true });
    await runGraphify(['global', 'remove', id]);
    cache.delete(graphJsonPath(id));
    return true;
  } catch { return false; }
}

export interface QueryResult { answer: string; tokens: number; miss: boolean }

// Roda `graphify query`. `miss` = nenhum nó casou com os termos (o graphify casa
// keyword→label de código, então pergunta em PT natural quase sempre erra; a UI
// usa miss pra orientar o usuário a buscar por identificadores).
export async function queryGraph(id: string, question: string, budget = 2000): Promise<QueryResult | null> {
  const p = pathFor(id);
  if (!p || !(await isFile(p))) return null;
  const q = question.trim().slice(0, 500);
  if (!q) return { answer: '', tokens: 0, miss: false };
  if (rejectFlagLike(q)) return { answer: 'a consulta não pode começar com "-"', tokens: 0, miss: false };
  const b = Math.max(200, Math.min(8000, Math.round(budget)));
  const { out } = await runGraphify(['query', q, '--graph', p, '--budget', String(b)]);
  const answer = out.trim().slice(0, 40_000);
  const miss = answer.startsWith(MISS_MARKER);
  if (!miss) void saveResult(id, q, answer);
  return { answer, tokens: Math.round(answer.length / 4), miss };
}

export type NodeOp = 'explain' | 'affected' | 'path';

// Operações de nó do graphify (as consultas de maior valor): explicar um nó,
// achar o que é impactado por ele, ou o caminho entre dois nós.
export async function nodeOp(id: string, op: NodeOp, a: string, b?: string): Promise<QueryResult | null> {
  const p = pathFor(id);
  if (!p || !(await isFile(p))) return null;
  const la = a.trim().slice(0, 200);
  if (!la || rejectFlagLike(la)) return null;
  let args: string[];
  if (op === 'explain') args = ['explain', la, '--graph', p];
  else if (op === 'affected') args = ['affected', la, '--graph', p];
  else {
    const lb = (b ?? '').trim().slice(0, 200);
    if (!lb || rejectFlagLike(lb)) return null;
    args = ['path', la, lb, '--graph', p];
  }
  const { out } = await runGraphify(args);
  const answer = out.trim().slice(0, 40_000);
  return { answer, tokens: Math.round(answer.length / 4), miss: answer.startsWith(MISS_MARKER) };
}

// Loop de memória: grava Q&A úteis no diretório de memória do graphify pro
// `reflect` (cron) destilar lições depois. Best-effort, nunca bloqueia a resposta.
async function saveResult(id: string, question: string, answer: string): Promise<void> {
  try {
    const memDir = id === GLOBAL_ID ? join(homedir(), '.graphify', 'memory') : join(graphDir(id), 'graphify-out', 'memory');
    await runGraphify(['save-result', '--question', question, '--answer', answer.slice(0, 2000), '--type', 'query', '--memory-dir', memDir]);
  } catch { /* memória é opcional */ }
}

export { GRAPHS_DIR, GLOBAL_ID };
