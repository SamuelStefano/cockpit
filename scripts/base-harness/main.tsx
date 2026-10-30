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
  threads: { s2: [question] as never },
  peeks: { s3: { lastAssistant: 'Real transcript tail from the peek.', prs: [], links: [] } },
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
