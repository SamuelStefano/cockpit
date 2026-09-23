import { describe, it, expect } from 'vitest';
import { createTopicMatcher, matchTopics, type MatchDoc } from './topics';
import { emptyTopics } from './refs';

const hub = (id: string, links: string[] = []): MatchDoc => ({ id, name: id.replace(/_/g, '-'), description: '', hub: true, links });
const leaf = (id: string, description = ''): MatchDoc => ({ id, name: id.replace(/_/g, '-'), description });

// A small realistic-shaped corpus: hubs wikilink their own family leaves,
// exactly like the real MEMORY.md hub files do.
const docs: MatchDoc[] = [
  hub('hub_dfl', ['dfl_edge_functions', 'dfl_mcp_token_refresh']),
  hub('hub_deck', ['cockpit_ping_regression', 'deck_todo']),
  hub('hub_pessoal', ['clt_applications_2026_08', 'job_hunt_sources_2026_08']),
  hub('hub_itera', ['itera_auth_email_smtp']),
  leaf('dfl_edge_functions'), leaf('dfl_mcp_token_refresh'),
  leaf('cockpit_ping_regression'), leaf('deck_todo'),
  leaf('clt_applications_2026_08'), leaf('job_hunt_sources_2026_08'),
  leaf('itera_auth_email_smtp'),
  leaf('deck_claude_cli_dois_installs'), leaf('deck_claude_dir_write_gated'), // linked under hub_deck in real data, unlinked here on purpose
  leaf('safra_app_pai'), // orphan: no hub links it
];

describe('matchTopics: hub vote (rule 1)', () => {
  it('routes a generic family token (mcp server) to the hub its leaves belong to, not to a specific leaf', () => {
    const topics = { ...emptyTopics(), mcp: { 'dfl-work': 6 } };
    const m = matchTopics(topics, '', docs);
    expect(m).toEqual([{ id: 'hub_dfl', score: 5, kind: 'hub' }]);
  });

  it('uses the alias table for a signal word with no leaf prefix of its own', () => {
    const topics = { ...emptyTopics(), dirs: { divida: 5 } };
    const m = matchTopics(topics, '', docs);
    expect(m.filter((x) => x.kind === 'hub').map((x) => x.id)).toEqual(['hub_pessoal']);
  });

  it('does NOT vote a hub for a family word whose leaves are unlinked (the false positive the coordinator flagged)', () => {
    // "claude" is a middle segment of deck_claude_* ids, not their prefix, and
    // those two leaves are deliberately left unlinked from hub_deck above —
    // this reproduces "MCP claude_design tools" wrongly reaching deck leaves.
    const topics = { ...emptyTopics(), mcp: { claude_design: 4 } };
    expect(matchTopics(topics, '', docs)).toEqual([]);
  });

  it('never lets an MCP-family token reach many unrelated leaves and drown the score in noise: one hub, one vote', () => {
    const topics = { ...emptyTopics(), mcp: { 'dfl-supabase': 6 } };
    const m = matchTopics(topics, '', docs);
    expect(m.filter((x) => x.kind === 'hub')).toHaveLength(1);
  });

  it('emits a second hub only when it is close to the top one', () => {
    const close = createTopicMatcher(docs)({ dirs: { clt: 5 }, skills: {}, mcp: { 'dfl-edge-functions': 4 } }, '');
    expect(close.filter((x) => x.kind === 'hub').map((x) => x.id).sort()).toEqual(['hub_dfl', 'hub_pessoal']);

    const farApart = createTopicMatcher(docs)({ dirs: { clt: 5 }, skills: {}, mcp: { 'dfl-edge-functions': 1 } }, '');
    expect(farApart.filter((x) => x.kind === 'hub').map((x) => x.id)).toEqual(['hub_pessoal']);
  });

  it('a lone title word below the family-prefix bar votes for nothing (the "daily" false positive)', () => {
    expect(matchTopics(undefined, 'Monte a mensagem de daily hoje', docs)).toEqual([]);
  });

  it('title words corroborating each other (itera + its alias educar) clear the hub floor', () => {
    // A single stray word is worth 1, below HUB_MIN_SCORE(2) on its own — this
    // is deliberate (see the "daily" case above); two independent words for
    // the same hub is real corroboration.
    const m = matchTopics(undefined, 'Aula de hoje no itera do educar', docs);
    expect(m).toEqual([{ id: 'hub_itera', score: 2, kind: 'hub' }]);
  });
});

describe('matchTopics: leaf edge (rule 2, exact evidence only)', () => {
  it('matches a dir token that is the whole prefix of a leaf id, even an orphan leaf with no hub', () => {
    const topics = { ...emptyTopics(), dirs: { safra: 3 } };
    const m = matchTopics(topics, '', docs);
    expect(m).toEqual([{ id: 'safra_app_pai', score: 3, kind: 'leaf' }]);
  });

  it('does not emit a leaf edge from an MCP token, even an exact one (only dirs/skills can)', () => {
    const topics = { ...emptyTopics(), mcp: { dfl_edge_functions: 3 } };
    const m = matchTopics(topics, '', docs);
    expect(m.some((x) => x.kind === 'leaf')).toBe(false);
    expect(m).toEqual([{ id: 'hub_dfl', score: 3, kind: 'hub' }]); // still votes for the hub, just not the leaf
  });

  it('does not emit a leaf edge from a title word', () => {
    const m = matchTopics(undefined, 'safra sistema de frutas', docs);
    expect(m.some((x) => x.kind === 'leaf')).toBe(false);
  });

  it('does not match a generic family word as a leaf (no false "dfl" -> one specific dfl_* leaf)', () => {
    const topics = { ...emptyTopics(), dirs: { dfl: 5 } };
    expect(matchTopics(topics, '', docs).some((x) => x.kind === 'leaf')).toBe(false);
  });

  it('caps leaf edges at 2', () => {
    const topics = { dirs: { clt: 5, job_hunt: 5, dfl_edge_functions: 5 }, skills: {}, mcp: {} };
    expect(matchTopics(topics, '', docs).filter((x) => x.kind === 'leaf').length).toBeLessThanOrEqual(2);
  });
});

describe('createTopicMatcher', () => {
  it('is reusable across sessions without recomputing the hub/leaf index', () => {
    const match = createTopicMatcher(docs);
    const a = match({ ...emptyTopics(), dirs: { safra: 1 } }, '');
    const b = match({ ...emptyTopics(), mcp: { 'dfl-work': 6 } }, '');
    expect(a).toEqual([{ id: 'safra_app_pai', score: 1, kind: 'leaf' }]);
    expect(b).toEqual([{ id: 'hub_dfl', score: 5, kind: 'hub' }]);
  });
});
