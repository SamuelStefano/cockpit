import { lazy, Suspense, useContext } from 'react';
import { Button } from '../../../components/primitives/Button';
import { ChatPrDepsContext, type ChatPrDeps } from './pr-deps-context';
import { useChatPrs } from './useChatPrs';

const ChatPrsPanel = lazy(() => import('./ChatPrsPanel').then((m) => ({ default: m.ChatPrsPanel })));

interface ChatPrsButtonProps { sessionId: string; markers: number; compact?: boolean }

function Inner({ sessionId, markers, compact, deps }: ChatPrsButtonProps & { deps: ChatPrDeps }) {
  const s = useChatPrs(sessionId, markers, deps.connected);
  const label = s.count ? `Pull requests desta conversa: ${s.count}` : 'Pull requests desta conversa';
  return (
    <>
      <Button
        variant="ghost" size="sm" icon="gitPullRequest" square={compact || !s.count} title={label} aria-label={label}
        aria-haspopup="dialog" aria-expanded={s.open} onClick={() => s.setOpen(true)}
        className={`relative ${compact ? 'pointer-coarse:h-11 pointer-coarse:w-11' : ''} ${s.count ? 'text-neutral-200' : ''}`}
      >
        {s.count > 0 && (compact
          ? <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold leading-none text-neutral-950">{s.count}</span>
          : <span className="rounded-full bg-orange-500/20 px-1.5 py-px text-[12px] font-semibold tabular-nums text-orange-300">{s.count}</span>)}
      </Button>
      {s.open && <Suspense fallback={null}><ChatPrsPanel state={s} deps={deps} /></Suspense>}
    </>
  );
}

// The chat's own PR button: which repositories this conversation touched and the
// code of each PR, one tap from the thread.
export function ChatPrsButton(props: ChatPrsButtonProps) {
  const deps = useContext(ChatPrDepsContext);
  // Keyed by chat: the open panel and the picked PR belong to one conversation.
  return deps ? <Inner key={props.sessionId} {...props} deps={deps} /> : null;
}
