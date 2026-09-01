import { describe, it, expect, vi, afterEach } from 'vitest';
import { rm } from 'node:fs/promises';
import { projectGraph, nameCommunity, rejectFlagLike, runGraphify, buildGraph, GRAPHIFY_TIMEOUT } from './graph';
import type { GraphNode } from '../shared/protocol';

// GRAPHS_DIR é lido no import do módulo; o hoisted roda antes dele. Sem isto o
// buildGraph do teste faria rm -rf no diretório de grafos REAL do Samuel.
const graphsDir = vi.hoisted(() => {
  const d = `${process.env.TMPDIR ?? '/tmp'}/cockpit-vitest-graphs-${process.pid}`;
  process.env.COCKPIT_GRAPHS_DIR = d;
  return d;
});

function node(id: string, over: Partial<GraphNode> = {}): GraphNode {
  return { id, label: id, community: 0, deg: 0, ...over };
}

describe('nameCommunity', () => {
  it('usa o diretório dominante (2 primeiros segmentos)', () => {
    const members = [
      node('a', { file: 'server/ws/dispatch.ts' }),
      node('b', { file: 'server/ws/runs.ts' }),
      node('c', { file: 'src/App.tsx' }),
    ];
    expect(nameCommunity(members)).toBe('server/ws');
  });

  it('desempata pelo alfabeticamente menor', () => {
    const members = [
      node('a', { file: 'src/a/x.ts' }),
      node('b', { file: 'src/b/y.ts' }),
    ];
    expect(nameCommunity(members)).toBe('src/a');
  });

  it('prefixa o repo dominante no grafo global', () => {
    const members = [
      node('a', { file: 'server/ws/x.ts', repo: 'cockpit' }),
      node('b', { file: 'server/ws/y.ts', repo: 'cockpit' }),
    ];
    expect(nameCommunity(members)).toBe('cockpit · server/ws');
  });

  it('retorna vazio quando não há arquivos (caller cai em "comunidade N")', () => {
    expect(nameCommunity([node('a'), node('b')])).toBe('');
  });

  it('ignora caminhos absolutos (cross-repo) ao nomear', () => {
    const members = [
      node('a', { file: '/home/samuel/x/y.ts' }),
      node('b', { file: 'lib/util.ts' }),
    ];
    expect(nameCommunity(members)).toBe('lib');
  });
});

describe('rejectFlagLike', () => {
  it('marca args que começam com "-" (anti flag-injection no graphify)', () => {
    expect(rejectFlagLike('-rf')).toBe(true);
    expect(rejectFlagLike('--graph')).toBe(true);
    expect(rejectFlagLike('-')).toBe(true);
  });

  it('aceita termos e identificadores normais', () => {
    expect(rejectFlagLike('queryGraph')).toBe(false);
    expect(rejectFlagLike('server/ws/dispatch.ts')).toBe(false);
    expect(rejectFlagLike('')).toBe(false);
  });
});

describe('projectGraph', () => {
  const raw = {
    directed: false,
    nodes: [
      { id: 'n1', label: 'a', community: 3, source_file: 'src/a/x.ts' },
      { id: 'n2', label: 'b', community: 3, source_file: 'src/a/y.ts' },
      { id: 'n3', label: 'c', community: 7, community_name: 'Community 7' },
    ],
    links: [
      { source: 'n1', target: 'n2', relation: 'imports', confidence: 'EXTRACTED' },
      { source: 'n2', target: 'n3', relation: 'calls', confidence: 'INFERRED' },
    ],
  };

  it('calcula o grau a partir das arestas', () => {
    const g = projectGraph(raw);
    expect(g.nodes.find((n) => n.id === 'n2')!.deg).toBe(2);
    expect(g.nodes.find((n) => n.id === 'n1')!.deg).toBe(1);
  });

  it('resolve nome de comunidade placeholder pelo diretório', () => {
    const g = projectGraph(raw);
    const c3 = g.communities.find((c) => c.id === 3)!;
    expect(c3.name).toBe('src/a');
    // comunidade 7 sem arquivos → "comunidade 7"
    expect(g.communities.find((c) => c.id === 7)!.name).toBe('comunidade 7');
  });

  it('preserva relation e confidence nas arestas', () => {
    const g = projectGraph(raw);
    const e = g.edges.find((x) => x.source === 'n2' && x.target === 'n3')!;
    expect(e.relation).toBe('calls');
    expect(e.confidence).toBe('INFERRED');
  });

  it('descarta arestas órfãs após o corte de nós', () => {
    const g = projectGraph({ nodes: [{ id: 'n1' }], links: [{ source: 'n1', target: 'ausente' }] });
    expect(g.edges).toHaveLength(0);
  });

  it('lida com entrada vazia/inválida', () => {
    expect(projectGraph(null).nodes).toHaveLength(0);
    expect(projectGraph({}).totalNodes).toBe(0);
  });
});

// O graphify é um binário EXTERNO. Sem teto, um spawn travado nunca resolve — e
// como o `finally` do buildGraph é quem devolve o single-flight, um build travado
// bloqueava TODOS os builds seguintes até reiniciar o backend.
describe('runGraphify (teto de tempo)', () => {
  afterEach(() => { delete process.env.COCKPIT_GRAPHIFY_BIN; });

  it('aborta o processo travado em vez de esperar pra sempre', async () => {
    process.env.COCKPIT_GRAPHIFY_BIN = '/bin/sleep';
    const t0 = Date.now();
    const { code, out } = await runGraphify(['30'], undefined, 150);
    expect(code).toBe(-1);
    expect(out).toContain(GRAPHIFY_TIMEOUT);
    expect(Date.now() - t0).toBeLessThan(3000); // resolveu no teto, não no sleep 30
  });

  it('não marca timeout no processo que termina dentro do teto', async () => {
    process.env.COCKPIT_GRAPHIFY_BIN = '/bin/echo';
    const { code, out } = await runGraphify(['pronto'], undefined, 5000);
    expect(code).toBe(0);
    expect(out).toContain('pronto');
    expect(out).not.toContain(GRAPHIFY_TIMEOUT);
  });
});

describe('buildGraph (single-flight)', () => {
  afterEach(async () => {
    delete process.env.COCKPIT_GRAPHIFY_BIN;
    await rm(graphsDir, { recursive: true, force: true });
  });

  it('devolve o single-flight quando o build falha, aceitando o próximo', async () => {
    process.env.COCKPIT_GRAPHIFY_BIN = '/bin/false';
    const first = await buildGraph(__dirname);
    expect(first.ok).toBe(false);
    const second = await buildGraph(__dirname);
    expect(second.ok).toBe(false);
    // O que importa é NÃO ser "já existe um build em andamento": o lock foi devolvido.
    expect(second.error).toBe(first.error);
  });

  it('recusa caminho que não é diretório antes de tocar o lock', async () => {
    const r = await buildGraph(`${graphsDir}/nao-existe`);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('não é um diretório');
    process.env.COCKPIT_GRAPHIFY_BIN = '/bin/false';
    expect((await buildGraph(__dirname)).error).not.toContain('em andamento');
  });
});
