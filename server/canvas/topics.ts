import type { SessionTopics } from './refs';

// Session -> context matching. Pure and testable: given a session's loose
// signals (repos/dirs, skills, MCP servers — see refs.ts) plus a session title,
// score every memory context (leaf or hub) and keep the top few above a floor.
//
// Contexts are named after the same prefix families the router table in
// MEMORY.md lists (dfl_*, deck_*/cockpit_*, itera_*/educar_*, samuel_*/user_*/
// clt_*/job_*, portfolio_*/trading*/valdez_*/anchor_*, vps_*/dokploy_*/
// supabase_*), and hub ids literally contain the family word (`hub_dfl`,
// `hub_deck`...). So most of the matching is just "does the normalized token
// appear in the context id/name/description" — no hardcoded id list needed.
// A small alias table only covers the handful of signals whose own word isn't
// a memory prefix (the repo is literally named `cockpit`; `upwork`/`divida`/
// a raw `job` mention carry no leaf prefix of their own) per the brief's
// explicit examples.

export interface MatchDoc {
  id: string;
  name: string;
  description: string;
}

export interface TopicMatch {
  id: string;
  score: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[-\s]+/g, '_').replace(/[^a-z0-9_]/g, '');

// token -> extra family words to also try, beyond the token itself and its
// `dfl_something` -> `dfl` generic family.
const ALIASES: Record<string, string[]> = {
  cockpit: ['deck', 'cockpit'],
  deck: ['deck', 'cockpit'],
  divida: ['pessoal', 'samuel', 'clt', 'job'],
  upwork: ['pessoal', 'samuel', 'clt', 'job', 'upwork'],
  job: ['pessoal', 'samuel', 'clt', 'job'],
  fiverr: ['pessoal', 'samuel', 'clt', 'job'],
};

// A token's candidate family words: itself, its `<family>_*` prefix (the part
// before the first `_`), and any alias. `dfl-edge-functions` -> `dfl_edge_functions`,
// family `dfl`; `mcp__dfl-work__list_tasks`'s server token `dfl-work` -> family `dfl`.
function tokenFamilies(tokenRaw: string): string[] {
  const t = norm(tokenRaw);
  if (!t) return [];
  const fam = t.split('_')[0];
  const out = new Set<string>([t, fam, ...(ALIASES[t] ?? []), ...(ALIASES[fam] ?? [])]);
  return [...out].filter(Boolean);
}

function docHay(doc: MatchDoc): string {
  return `${norm(doc.id)} ${norm(doc.name)}`;
}

// Weight per hit: an exact normalized-id match is a strong signal (this token
// IS the leaf); a family/substring hit (e.g. "dfl" inside "dfl_edge_functions")
// is weaker, and matching only the free-text description weaker still.
function scoreDoc(doc: MatchDoc, families: string[], count: number): number {
  const idHay = docHay(doc);
  const descHay = norm(doc.description);
  let best = 0;
  for (const f of families) {
    if (!f || f.length < 3) continue; // "id"/"a" etc would match almost everything
    if (idHay === f) best = Math.max(best, 3);
    else if (new RegExp(`(^|_)${f}(_|$)`).test(idHay)) best = Math.max(best, 2);
    else if (descHay.includes(f)) best = Math.max(best, 1);
  }
  return best * Math.min(count, 5); // more mentions strengthen a hit, capped so one chatty session can't dominate
}

export const TOPIC_MATCH_LIMIT = 3;
export const TOPIC_MATCH_MIN_SCORE = 3;

// Title/snippet text is matched as free-text against description only (weight 1
// per family word present), since a title has no "family" structure of its own.
function scoreText(doc: MatchDoc, text: string): number {
  if (!text) return 0;
  const words = norm(text).split('_').filter((w) => w.length >= 4);
  const idHay = docHay(doc);
  let hits = 0;
  for (const w of new Set(words)) if (new RegExp(`(^|_)${w}(_|$)`).test(idHay)) hits++;
  return hits;
}

export function matchTopics(topics: SessionTopics | undefined, text: string, docs: MatchDoc[]): TopicMatch[] {
  const scores = new Map<string, number>();
  const add = (rec: Record<string, number> | undefined) => {
    if (!rec) return;
    for (const [token, count] of Object.entries(rec)) {
      const families = tokenFamilies(token);
      if (!families.length) continue;
      for (const doc of docs) {
        const s = scoreDoc(doc, families, count);
        if (s > 0) scores.set(doc.id, Math.max(scores.get(doc.id) ?? 0, s));
      }
    }
  };
  add(topics?.dirs);
  add(topics?.skills);
  add(topics?.mcp);
  for (const doc of docs) {
    const s = scoreText(doc, text);
    if (s > 0) scores.set(doc.id, Math.max(scores.get(doc.id) ?? 0, s));
  }
  return [...scores.entries()]
    .filter(([, score]) => score >= TOPIC_MATCH_MIN_SCORE)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOPIC_MATCH_LIMIT)
    .map(([id, score]) => ({ id, score }));
}
