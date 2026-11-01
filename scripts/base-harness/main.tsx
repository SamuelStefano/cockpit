// Dev-only page: renders the real /base route with fixture cockpit data, for browser checks without auth.
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { Base } from '../../src/routes/base/Base';
import type { LiveSource } from '../../src/routes/base/useLiveFeed';

const now = Date.now();
const calls: unknown[][] = [];
const log = (name: string) => (...a: unknown[]) => { calls.push([name, ...a]); return true; };
const XSS = '<img src=x onerror="window.__xss=1">Deck: hostile title';
const question = { id: 'a', role: 'assistant', blocks: [{ type: 'tool', tool: { id: 't', name: 'AskUserQuestion', status: 'done', output: [], questions: [{ question: 'Ship the relay fix now?', header: 'Ship', multiSelect: false, options: [{ label: 'Yes (recommended)' }, { label: 'Wait for review' }] }] } }] };
const tool = (name: string, command: string, over = {}) => ({ type: 'tool', tool: { id: `${name}-${command}`, name, label: name, command, status: 'done', output: [], ...over } });
const working = [
  { id: 'u1', role: 'user', text: 'Add the reconnect banner', ts: now - 600000 },
  { id: 'a1', role: 'assistant', ts: now - 500000, blocks: [
    { type: 'text', md: 'Reading the relay client first.' }, tool('Read', '/repo/src/relay.ts'), tool('Grep', 'reconnect'),
    tool('Write', '/repo/src/Banner.tsx', { diff: { path: '/repo/src/Banner.tsx', old: '', new: 'export function Banner() {\n  return <div>Reconnecting</div>;\n}' } }),
    tool('Edit', '/repo/src/App.tsx', { diff: { path: '/repo/src/App.tsx', old: '<Main />', new: '<Banner />\n<Main />' } }),
    tool('Bash', 'npm test -- Banner', { status: 'error', output: ['FAIL Banner.test.tsx', 'expected Reconnecting'] }),
    tool('Agent', 'Review the banner', { label: 'Agent · Explore' }), tool('mcp__plans__create_plan', 'Banner plan'),
    tool('Bash', 'git push', { status: 'running' }),
  ] },
];
const source: LiveSource = {
  connected: true,
  sessions: [
    { id: 's1', title: XSS, relative: '', snippet: '', mtime: now - 1000, hasTerminal: false, active: false },
    { id: 's2', title: 'Deck: relay reconnect', relative: '', snippet: '', mtime: now - 2000, hasTerminal: false, active: false, waiting: true },
    { id: 's3', title: 'Itera: new kind', relative: '', snippet: '', mtime: now - 3000, hasTerminal: false, active: false },
    { id: 's4', title: 'Itera: context heavy', relative: '', snippet: '', mtime: now - 4000, hasTerminal: false, active: false },
    { id: 's5', title: 'no prefix session', relative: '', snippet: '', mtime: now - 5000, hasTerminal: false, active: false },
  ],
  running: new Set(['s1', 's3']),
  termStats: { s1: { model: 'claude-opus-4-5', contextTokens: 40000 }, s4: { model: 'claude-sonnet-4-5', contextTokens: 170000 } },
  threads: { s2: [question] as never, s1: working as never },
  peeks: { s3: { lastAssistant: 'Real transcript tail from the peek.', prs: [{ url: 'https://github.com/x/y/pull/1', label: 'PR #1' }], links: [] } },
  todos: {
    s1: [{ content: 'Read the relay client', status: 'completed' }, { content: 'Write the banner', status: 'in_progress' }, { content: 'Run the tests', status: 'pending' }],
  },
  bgAgents: { s1: [{ id: 'b1', label: 'Explore', startedAt: now - 60000, tokens: 1200, status: 'running', durationMs: 0 }] },
  teamQuestions: [],
  graph: null,
  board: { cards: [{ id: 'c1', title: 'Card in review', prompt: '', status: 'review', kind: 'task', contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0 }, { id: 'c2', title: 'Card todo', prompt: '', status: 'todo', kind: 'task', contextIds: [], sessionIds: [], createdAt: 0, updatedAt: 0 }] } as never,
  boardLoaded: true,
  stats: { cpu: 10, mem: { used: 1, total: 2 }, gpu: null, disk: { used: 60, total: 100 }, load: 1 },
  crons: [],
  mcpServers: null,
  onCtxStats: () => {}, onPeek: () => {}, onLoadThread: () => {}, onCanvasGet: () => {}, onCronsGet: () => {},
  onSendTo: log('send'), onStop: log('stop') as never, onOpenSession: log('open') as never,
};
(window as unknown as { __calls: unknown[][] }).__calls = calls;
createRoot(document.getElementById('root')!).render(<Base source={source} />);
