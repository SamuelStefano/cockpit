import type { SessionTopics } from './refs';

// Session -> context matching. Pure and testable: given a session's loose
// signals (repos/dirs, skills, MCP servers — see refs.ts) plus a session
// title, guess which memory contexts it belongs to.
//
// Two separate rules, on purpose (measured false positives forced this split
// — see the precision table in PROGRESS.log):
//
// 1. HUB VOTE (the main output). A generic family word like "dfl" or "claude"
//    is too common to safely name a LEAF — "claude_design" the MCP tool vs.
//    "deck-claude-cli-dois-installs" the leaf are both "claude" but unrelated.
//    It is precise enough to name a HUB though: every token votes for the
//    hub(s) reached by the *leaves* whose id it matches (via the hub's own
//    wikilinks — the same `link` edges the graph already draws), the vote
//    split evenly across however many hubs it reaches. Only the top hub (and
//    a close second) survive.
// 2. LEAF edge only on exact evidence: a dir or skill token (never an MCP
//    server, never a title word — those are the ones that produced the false
//    positives) that IS a leaf id, or is the leaf id's whole prefix before
//    its first `_`. `safra` dir -> `safra_app_pai` is fine (exact prefix);
//    `dfl` mcp token -> some `dfl_*` leaf is NOT (that's a hub-only signal).
//
// A small alias table only covers signal words that are not themselves a
// memory-leaf prefix: the repo is literally named `cockpit` (leaves use
// `deck_`/`cockpit_`), and `upwork`/`divida`/`fiverr`/raw `job` mentions or
// `educar` (Educar+) carry no leaf prefix of their own.

export interface MatchDoc {
  id: string;
  name: string;
  description: string;
  hub?: boolean;
  links?: string[]; // hub docs only: wikilinked leaf ids/names -> which leaves this hub claims
}

export interface TopicMatch {
  id: string;
  score: number;
  kind: 'hub' | 'leaf';
}

const norm = (s: string) => s.toLowerCase().replace(/[-\s]+/g, '_').replace(/[^a-z0-9_]/g, '');

const ALIASES: Record<string, string[]> = {
  cockpit: ['deck', 'cockpit'],
  deck: ['deck', 'cockpit'],
  divida: ['pessoal', 'samuel', 'clt', 'job'],
  upwork: ['pessoal', 'samuel', 'clt', 'job', 'upwork'],
  job: ['pessoal', 'samuel', 'clt', 'job'],
  fiverr: ['pessoal', 'samuel', 'clt', 'job'],
  educar: ['itera', 'educar'],
};

// A token's candidate family words: itself, its `<family>_*` prefix (the part
// before the first `_`), and any alias.
function tokenFamilies(tokenRaw: string): string[] {
  const t = norm(tokenRaw);
  if (!t) return [];
  const fam = t.split('_')[0];
  const out = new Set<string>([t, fam, ...(ALIASES[t] ?? []), ...(ALIASES[fam] ?? [])]);
  return [...out].filter((w) => w.length >= 3); // "id"/"a" etc would match almost everything
}

export const HUB_MIN_SCORE = 2;
export const HUB_SECOND_RATIO = 0.6;
export const LEAF_MAX = 2;
const WEIGHT_CAP = 5; // more mentions strengthen a hit, capped so one chatty session can't dominate

// Precomputed once per `docs` array (the memory contexts, which do not change
// per-session) rather than per session: building the hub->leaf map is the
// only part of this that needs the whole corpus, everything else is a lookup.
export function createTopicMatcher(docs: MatchDoc[]) {
  const leaves = docs.filter((d) => !d.hub);
  const leafByNorm = new Map<string, MatchDoc>();
  for (const l of leaves) {
    leafByNorm.set(norm(l.id), l);
    if (l.name) leafByNorm.set(norm(l.name), l);
  }
  // leaf id -> hub ids that wikilink it (usually one hub, but a leaf could in
  // principle be referenced from more than one hub file).
  const hubOfLeaf = new Map<string, string[]>();
  for (const h of docs) {
    if (!h.hub) continue;
    for (const link of h.links ?? []) {
      const leaf = leafByNorm.get(norm(link));
      if (leaf) hubOfLeaf.set(leaf.id, [...(hubOfLeaf.get(leaf.id) ?? []), h.id]);
    }
  }
  // Leaves whose id starts with `word_` or equals `word`, indexed by that
  // family word so both the hub vote and the leaf-exact rule reuse one scan.
  function leavesFor(word: string): MatchDoc[] {
    return leaves.filter((l) => {
      const idHay = norm(l.id);
      return idHay === word || idHay.startsWith(`${word}_`);
    });
  }

  // Rule 1: which hubs does this token reach, through its family words and
  // the leaves those words match?
  function hubsFor(tokenRaw: string): Set<string> {
    const hubs = new Set<string>();
    for (const w of tokenFamilies(tokenRaw)) {
      for (const l of leavesFor(w)) for (const h of hubOfLeaf.get(l.id) ?? []) hubs.add(h);
    }
    return hubs;
  }

  // Rule 2: exact leaf evidence only — the whole normalized token, not a
  // family word, so "dfl" (too generic) never qualifies but "safra" or
  // "dfl-edge-functions" (specific enough to BE or prefix a leaf id) do.
  // A token whose prefix search hits MORE THAN ONE leaf is, by construction,
  // a shared family word rather than one leaf's own name — read literally,
  // "starts with token + `_`" would also let a bare "dfl" dir/skill token
  // (which never happens in real data, but must not be trusted if it did)
  // match every `dfl_*` leaf; requiring a single hit keeps this rule to
  // genuinely 1:1 evidence and pushes anything ambiguous back to the hub vote.
  function exactLeavesFor(tokenRaw: string): MatchDoc[] {
    const t = norm(tokenRaw);
    if (t.length < 3) return [];
    const hits = leavesFor(t);
    return hits.length === 1 ? hits : [];
  }

  function match(topics: SessionTopics | undefined, text: string): TopicMatch[] {
    const hubScores = new Map<string, number>();
    const bumpHub = (id: string, s: number) => hubScores.set(id, (hubScores.get(id) ?? 0) + s);

    const voteFromTokens = (rec: Record<string, number> | undefined) => {
      if (!rec) return;
      for (const [token, count] of Object.entries(rec)) {
        const hubs = hubsFor(token);
        if (!hubs.size) continue;
        const w = Math.min(count, WEIGHT_CAP) / hubs.size;
        for (const h of hubs) bumpHub(h, w);
      }
    };
    voteFromTokens(topics?.dirs);
    voteFromTokens(topics?.skills);
    voteFromTokens(topics?.mcp);

    const words = new Set(norm(text).split('_').filter((w) => w.length >= 4));
    for (const word of words) {
      const hubs = hubsFor(word);
      if (!hubs.size) continue;
      const w = 1 / hubs.size;
      for (const h of hubs) bumpHub(h, w);
    }

    const ranked = [...hubScores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const out: TopicMatch[] = [];
    if (ranked.length && ranked[0][1] >= HUB_MIN_SCORE) {
      out.push({ id: ranked[0][0], score: ranked[0][1], kind: 'hub' });
      const second = ranked[1];
      if (second && second[1] >= HUB_MIN_SCORE && second[1] >= ranked[0][1] * HUB_SECOND_RATIO) {
        out.push({ id: second[0], score: second[1], kind: 'hub' });
      }
    }

    const leafScores = new Map<string, number>();
    const bumpLeaf = (id: string, s: number) => leafScores.set(id, Math.max(leafScores.get(id) ?? 0, s));
    const collectLeaves = (rec: Record<string, number> | undefined) => {
      if (!rec) return;
      for (const [token, count] of Object.entries(rec)) {
        for (const l of exactLeavesFor(token)) bumpLeaf(l.id, Math.min(count, WEIGHT_CAP));
      }
    };
    collectLeaves(topics?.dirs);
    collectLeaves(topics?.skills); // MCP tokens deliberately excluded: family-only signal, never exact leaf evidence
    for (const [id, score] of [...leafScores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, LEAF_MAX)) {
      out.push({ id, score, kind: 'leaf' });
    }

    return out;
  }

  return match;
}

export function matchTopics(topics: SessionTopics | undefined, text: string, docs: MatchDoc[]): TopicMatch[] {
  return createTopicMatcher(docs)(topics, text);
}
