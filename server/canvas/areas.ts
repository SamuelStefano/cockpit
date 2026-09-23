import { type AreaId, type CanvasEdge, type CanvasNode } from '../../shared/canvas';

// Work-front classification, pure and testable: given the graph buildCanvasGraph
// already produced, decide which area every hub, leaf and session belongs to.
//
// 1. HUB: named by its own id prefix (the memory router's own naming convention —
//    see ~/.claude/projects/-home-samuel/memory/MEMORY.md's hub table).
// 2. LEAF: inherits its hub's area through the 'link' edge the graph already
//    draws from a hub file to a leaf it wikilinks (same edge canvas-layout.ts's
//    `hubOf` reads to cluster leaves under their hub). A leaf wikilinked from
//    more than one hub picks the alphabetically-first hub id — deterministic
//    regardless of readdir/edge iteration order, which is NOT guaranteed
//    stable across filesystems.
// 3. SESSION: takes the area of whichever hub/leaf it touched the most, voting
//    with the same edges the graph scores a session's memory trail with
//    ('read'/'write' = a real tool call, weight = touch count when the
//    scanner recorded one (refs.ts's contextHits), else 1; 'topic' = an
//    inferred guess, weight = the match score already on the edge). A tie in
//    score breaks on the MOST RECENT evidence (the touched context's mtime),
//    not on area name — only a full tie on both falls back to area id, so the
//    result stays deterministic without name bias driving real decisions.
//    A session with zero votes still gets 'outros' rather than staying
//    unclassified, so it can't silently escape every area budget.

function areaOfHub(hubId: string): AreaId {
  if (hubId.startsWith('hub_dfl')) return 'dfl';
  if (hubId === 'hub_itera') return 'itera';
  if (hubId === 'hub_deck') return 'deck';
  if (hubId === 'hub_pessoal' || hubId === 'hub_projetos_pessoais') return 'pessoal';
  if (hubId === 'hub_infra_integracoes') return 'infra';
  return 'outros';
}

const VOTE_EDGE_KINDS = new Set(['read', 'write', 'topic']);

export function classifyAreas(nodes: CanvasNode[], edges: CanvasEdge[]): Map<string, AreaId> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, AreaId>();

  for (const n of nodes) if (n.kind === 'context' && n.hub) out.set(n.id, areaOfHub(n.ref));

  // Collect every hub that wikilinks a given leaf first, THEN pick deterministically
  // (alphabetically-first hub id) — picking whichever hub's edge happened to be
  // pushed first would depend on readContextDir's readdir order, which the OS
  // does not guarantee.
  const leafHubs = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind !== 'link') continue;
    const hub = byId.get(e.source);
    const leaf = byId.get(e.target);
    if (hub?.kind === 'context' && hub.hub && leaf?.kind === 'context' && !leaf.hub) {
      leafHubs.set(leaf.id, [...(leafHubs.get(leaf.id) ?? []), hub.id]);
    }
  }
  for (const [leafId, hubIds] of leafHubs) {
    const winner = [...hubIds].sort()[0];
    out.set(leafId, out.get(winner)!);
  }

  interface Vote { score: number; lastAt: number }
  const sessionVotes = new Map<string, Map<AreaId, Vote>>();
  for (const e of edges) {
    if (!VOTE_EDGE_KINDS.has(e.kind)) continue;
    const session = byId.get(e.source);
    const ctx = byId.get(e.target);
    if (session?.kind !== 'session' || ctx?.kind !== 'context') continue;
    const area = out.get(ctx.id);
    if (!area) continue;
    const votes = sessionVotes.get(session.id) ?? new Map<AreaId, Vote>();
    const cur = votes.get(area) ?? { score: 0, lastAt: 0 };
    votes.set(area, { score: cur.score + (e.weight ?? 1), lastAt: Math.max(cur.lastAt, ctx.mtime) });
    sessionVotes.set(session.id, votes);
  }
  for (const [sid, votes] of sessionVotes) {
    let best: AreaId | undefined;
    let bestVote: Vote = { score: -Infinity, lastAt: -Infinity };
    // Sorted by area id only as the LAST-resort tie-break (see below) — score
    // and recency are checked first, so this never drives a real decision.
    for (const [area, v] of [...votes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (v.score > bestVote.score || (v.score === bestVote.score && v.lastAt > bestVote.lastAt)) { best = area; bestVote = v; }
    }
    if (best) out.set(sid, best);
  }

  // A session that voted for nothing (no memory trail at all) still lands
  // somewhere — 'outros' — so it can't sit outside every area's budget forever.
  for (const n of nodes) if (n.kind === 'session' && !out.has(n.id)) out.set(n.id, 'outros');

  return out;
}

// Mutates nothing: caller decides whether/how to merge this into CanvasNode.area.
export function areasByNode(nodes: CanvasNode[], edges: CanvasEdge[]): Record<string, AreaId> {
  return Object.fromEntries(classifyAreas(nodes, edges));
}
