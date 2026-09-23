// Precision check for topic edges (BRIEF A, task 2): prints title + assigned
// contexts for the 30 most recent sessions so the match can be eyeballed for
// false positives before shipping. Run with a scratch cache so this never
// touches the real one:
//
//   COCKPIT_CANVAS_REFS=/tmp/canvas-a-refs.json npx tsx scripts/measure-topic-precision.mts
import { buildCanvas } from '../server/canvas/index';

const graph = await buildCanvas();
const sessions = graph.nodes
  .filter((n) => n.kind === 'session' && !n.archived)
  .sort((a, b) => b.mtime - a.mtime)
  .slice(0, 30);

const byId = new Map(graph.nodes.map((n) => [n.id, n]));
const topicByTarget = new Map<string, { target: string; weight: number }[]>();
for (const e of graph.edges) {
  if (e.kind !== 'topic') continue;
  topicByTarget.set(e.source, [...(topicByTarget.get(e.source) ?? []), { target: e.target, weight: e.weight ?? 0 }]);
}

let withTopic = 0;
for (const s of sessions) {
  const matches = (topicByTarget.get(s.id) ?? []).sort((a, b) => b.weight - a.weight);
  if (matches.length) withTopic++;
  const label = matches.length
    ? matches.map((m) => `${byId.get(m.target)?.title ?? m.target} (${m.weight.toFixed(2)})`).join(', ')
    : '(nenhum)';
  console.log(`${s.title.slice(0, 70).padEnd(70)} -> ${label}`);
}
console.log(`\n${withTopic}/${sessions.length} sessões recentes ganharam ao menos 1 contexto topic.`);
