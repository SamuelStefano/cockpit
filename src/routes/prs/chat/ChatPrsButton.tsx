import { lazy, Suspense, useContext, useEffect } from 'react';
import { Button } from '../../../components/primitives/Button';
import { ChatPrDepsContext, type ChatPrDeps } from './pr-deps-context';
import { useChatPrs } from './useChatPrs';

const ChatPrsPanel = lazy(() => import('./ChatPrsPanel').then((m) => ({ default: m.ChatPrsPanel })));

interface ChatPrsButtonProps {
  sessionId: string;
  markers: number;
  compact?: boolean;
  // Phone: the header menu owns the trigger; each bump of the signal opens the panel.
  openSignal?: number;
  hideTrigger?: boolean;
  onCount?: (count: number) => void;
}

function Inner({ sessionId, markers, compact, openSignal = 0, hideTrigger = false, onCount, deps }: ChatPrsButtonProps & { deps: ChatPrDeps }) {
  const s = useChatPrs(sessionId, markers, deps.connected);
  const { setOpen } = s;
  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal, setOpen]);
  const { count } = s;
  useEffect(() => { onCount?.(count); }, [count, onCount]);
  const label = s.count ? `Pull requests desta conversa: ${s.count}` : 'Pull requests desta conversa';
  return (
    <>
      {!hideTrigger && <Button
        variant="ghost" size="xs" icon="gitPullRequest" square={compact || !s.count} title={label} aria-label={label}
        aria-haspopup="dialog" aria-expanded={s.open} onClick={() => s.setOpen(true)}
        className={`relative ${compact ? 'pointer-coarse:h-11 pointer-coarse:w-11' : ''} ${s.count ? 'text-neutral-200' : ''}`}
      >
        {s.count > 0 && (compact
          ? <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold leading-none text-neutral-950">{s.count}</span>
          : <span className="rounded-full bg-orange-500/20 px-1.5 py-px text-[12px] font-semibold tabular-nums text-orange-300">{s.count}</span>)}
      </Button>}
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
