// Dev-only page: the real /prs route and the chat's PR button fed from a captured
// fixture (see capture.mts), for browser checks without auth or a live socket.
//   ?view=chat  → only the chat header button (click it to open the panel)
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { Prs } from '../../src/routes/prs/Prs';
import { ChatPrsButton } from '../../src/routes/prs/chat/ChatPrsButton';
import { ChatPrDepsContext } from '../../src/routes/prs/chat/pr-deps-context';
import { prsDispatch, setPrsSender } from '../../src/routes/prs/prs-bus';

interface Fixture { frames: ServerMsg[]; sessionId: string }

const fixture = (await (await fetch('./fixture.json')).json()) as Fixture;
const answer = (m: ClientMsg): ServerMsg | undefined => fixture.frames.find((f) => {
  if (m.t === 'prs-get') return f.t === 'prs';
  if (m.t === 'prs-detail-get') return f.t === 'prs-detail' && f.url === m.url;
  if (m.t === 'prs-diff-get') return f.t === 'prs-diff' && f.url === m.url;
  if (m.t === 'prs-session-get') return f.t === 'prs-session';
  return false;
});

setPrsSender((m) => {
  const hit = answer(m);
  const fallback: ServerMsg | undefined = m.t === 'prs-diff-get' ? { t: 'prs-diff', url: m.url, diff: null, error: 'not in the fixture' } : undefined;
  setTimeout(() => { const f = hit ?? fallback; if (f) prsDispatch(f); }, 150);
  return true;
});

const deps = { onOpenSession: () => {}, onSendTo: () => true, onLaunchAgent: () => null, onAllPrs: () => {} };
const chat = new URLSearchParams(location.search).get('view') === 'chat';

createRoot(document.getElementById('root')!).render(
  <ChatPrDepsContext.Provider value={deps}>
    {chat ? (
      <div className="flex h-12 items-center gap-2 bg-[var(--bg-deep)] px-4">
        <span className="text-[14px] font-medium text-neutral-100">Demo conversation</span>
        <div className="ml-auto"><ChatPrsButton sessionId={fixture.sessionId} markers={0} /></div>
      </div>
    ) : <Prs connected {...deps} />}
  </ChatPrDepsContext.Provider>,
);
