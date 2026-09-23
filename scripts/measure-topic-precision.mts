// Precision check for topic edges (BRIEF A, task 2 + coordinator rework):
// prints title -> hubs + leaves for the 30 most recent NON-ping sessions, so
// the match can be eyeballed for false positives before shipping. Cron/
// keepalive pings ("Nao responder" and friends) are noise, not signal, and
// are skipped here the same way they are excluded from the "ativas" filter.
// Run with a scratch cache so this never touches the real one:
//
//   COCKPIT_CANVAS_REFS=/tmp/canvas-a-refs.json npx tsx scripts/measure-topic-precision.mts
import { buildCanvas } from '../server/canvas/index';
import { isCronPing } from '../shared/canvas';

const graph = await buildCanvas();
const byId = new Map(graph.nodes.map((n) => [n.id, n]));
const sessions = graph.nodes
  .filter((n) => n.kind === 'session' && !n.archived && n.count !== 0 && !isCronPing({ title: n.title, snippet: n.subtitle }))
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 30);

const topicByTarget = new Map<string, { target: string; weight: number; kind: 'hub' | 'leaf' }[]>();
for (const e of graph.edges) {
  if (e.kind !== 'topic') continue;
  const kind = byId.get(e.target)?.hub ? 'hub' : 'leaf';
  topicByTarget.set(e.source, [...(topicByTarget.get(e.source) ?? []), { target: e.target, weight: e.weight ?? 0, kind }]);
}

let withTopic = 0;
for (const s of sessions) {
  const matches = (topicByTarget.get(s.id) ?? []).sort((a, b) => b.weight - a.weight);
  if (matches.length) withTopic++;
  const hubs = matches.filter((m) => m.kind === 'hub').map((m) => `${byId.get(m.target)?.title ?? m.target} (${m.weight.toFixed(2)})`);
  const leaves = matches.filter((m) => m.kind === 'leaf').map((m) => `${byId.get(m.target)?.title ?? m.target} (${m.weight.toFixed(2)})`);
  const label = matches.length ? `hubs: ${hubs.join(', ') || '-'} | leaves: ${leaves.join(', ') || '-'}` : '(nenhum)';
  console.log(`${s.title.slice(0, 60).padEnd(60)} -> ${label}`);
}
console.log(`\n${withTopic}/${sessions.length} sessões (não-ping) ganharam ao menos 1 contexto topic.`);
