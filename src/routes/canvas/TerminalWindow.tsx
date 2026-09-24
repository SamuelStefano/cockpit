import { lazy, memo, Suspense, useRef, useState } from 'react';
import type { CanvasNode, CanvasPos, TermStats } from '../../../shared/canvas';
import type { TermApi } from '../../useCockpit';
import { AlertRing } from './CanvasAlert';
import { sessionAlert } from './canvas-alerts';
import { TERM_H, TERM_W } from './canvas-terms';
import { GhostSummaryBanner } from './GhostSummaryBanner';
import { SessionPromptBar } from './SessionPromptBar';
import { TerminalWindowHeader } from './TerminalWindowHeader';
import { TermStatsBar } from './TermStatsBar';
import { ctxPct } from './term-stats-view';
import { shouldShowGhostBanner, useGhostBanner } from './useGhostBanner';
import type { TermTarget } from './useCanvasTerms';

const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface Props {
  node: CanvasNode;
  pos: CanvasPos;
  target: TermTarget;
  term: TermApi;
  active: boolean;
  focusN: number;
  maximized: boolean;
  resuming: boolean;
  stats?: TermStats;
  selected: boolean;
  dim: boolean;
  running: boolean;
  waiting: boolean;
  // Below this the glyphs read as a grey smear, not text — clicking the body
  // then maximizes instead of typing (UX review 24/09 item 3).
  zoom: number;
  // The one session that commands every other one (shared/canvas.ts
  // OrchestratorInfo) — distinct chrome so it never blends into the rest.
  orchestrator: boolean;
  // The pane is (or was last put into) an interactive `claude --resume`,
  // outside Deck's own run tracking — sending through the prompt bar here
  // would start a SECOND writer on the same transcript.
  promptDisabled: boolean;
  past: boolean; // timeline scrubbed to a past instant: overlay "vendo o passado"
  instant: boolean; // timeline is playing: skip the opacity transition (perf)
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onActivate: (id: string) => void;
  onCollapse: (id: string) => void;
  onKill: (n: CanvasNode) => void;
  onMaximize: (id: string) => void;
  onResume: (sessionId: string) => void;
  onOpenChat: (sessionId: string) => void;
  // Stable reference (not a per-node bound closure — see CanvasWindows.tsx)
  // plus the raw sessionId, so this component's own memo isn't defeated.
  onSendTo: (sessionId: string, text: string) => boolean;
  sendError: { sessionId: string; text: string; message: string } | null;
  onDismissSendError: () => void;
  // Only set on the orchestrator's own window — pins it into the sidebar dock.
  onDock?: () => void;
}

// Same floor useCanvasViewport's centerOn uses for a node — below it a
// terminal's glyphs read as a grey smear, so clicking to "type" would just
// land on illegible text (UX review 24/09 item 3).
const UNREADABLE_BELOW = 0.7;

// A live tmux pane placed on the map. The title bar drags the window; the body
// belongs to the terminal only once activated, so an idle window never eats the
// wheel or a click meant for panning the canvas.
export const TerminalWindow = memo(function TerminalWindow(p: Props) {
  const n = p.node;
  const session = n.kind === 'session';
  const alert = session ? sessionAlert(p.waiting, p.stats) : null;
  const pct = p.stats ? ctxPct(p.stats) : null;
  const { dismissed: bannerDismissed, dismiss: dismissBanner } = useGhostBanner(n.ref);
  // Collapsed by default (spec: one-line, expand on click) — a ghost window
  // rarely needs the full summary on sight, and the collapsed strip is the
  // height that's permanently reserved (see GhostSummaryBanner.tsx).
  const [bannerCollapsed, setBannerCollapsed] = useState(true);
  const promptRef = useRef<HTMLInputElement>(null);
  const showBanner = shouldShowGhostBanner(session, bannerDismissed, n.subtitle);
  return (
    <div
      data-node={n.id}
      style={{ transform: `translate(${p.pos.x}px, ${p.pos.y}px)`, width: TERM_W, height: TERM_H }}
      className={`absolute left-0 top-0 flex flex-col overflow-hidden rounded-lg border bg-[#0a0a0a] shadow-2xl shadow-black/60
        ${p.instant ? '' : 'transition-opacity'}
        ${p.orchestrator
          ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/40 shadow-[0_0_28px_-4px_rgba(217,70,239,0.6)]'
          : p.active ? 'border-orange-500/80 ring-2 ring-orange-500/30' : p.selected ? 'border-orange-400/60' : 'border-neutral-700'}
        ${p.dim ? 'opacity-40' : ''}`}
    >
      <AlertRing kind={alert} />
      <TerminalWindowHeader
        node={n} session={session} orchestrator={p.orchestrator} running={p.running} waiting={p.waiting} resuming={p.resuming}
        alert={alert} pct={pct} onPointerDown={p.onPointerDown} onMaximize={p.onMaximize} onCollapse={p.onCollapse} onKill={p.onKill}
        onResume={p.onResume} onOpenChat={p.onOpenChat} onDock={p.onDock}
      />
      <TermStatsBar stats={p.stats} running={p.running} session={session} />
      {showBanner && (
        <GhostSummaryBanner
          summary={n.subtitle} lastActiveAt={p.stats?.lastAt ?? n.mtime}
          // Forced collapsed while running: nothing to "continue" mid-turn,
          // and running never gets to change the reserved strip's height.
          collapsed={bannerCollapsed || p.running} onToggleCollapsed={() => setBannerCollapsed((c) => !c)}
          onDismiss={dismissBanner} continueEnabled={!p.promptDisabled && !p.running}
          onContinue={() => promptRef.current?.focus()}
        />
      )}
      <div className="relative min-h-0 flex-1" data-term-active={p.active || undefined}>
        {p.maximized ? (
          <div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">em tela cheia</div>
        ) : (
          <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
            <XtermView id={p.target.termId} watch={p.target.watch} term={p.term} autoFocus={false} focusKey={p.active ? p.focusN : 0} />
          </Suspense>
        )}
        {!p.active && (() => {
          const unreadable = p.zoom < UNREADABLE_BELOW;
          return (
            <div
              className={`absolute inset-0 ${unreadable ? 'cursor-zoom-in' : 'cursor-text'}`}
              title={unreadable ? 'clique pra ampliar' : 'clique pra digitar'}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (unreadable) p.onMaximize(n.id);
                else p.onActivate(n.id);
              }}
              // The mousedown default moves focus to <body> after our focus() ran,
              // so the first keystroke after the click went nowhere.
              onMouseDown={(e) => e.preventDefault()}
            />
          );
        })()}
        {p.past && (
          // The xterm underneath stays mounted and live — this is a read-only
          // reminder, not a detach, so returning to "agora" is instant. Flat
          // background, no backdrop-blur: blurring the live xterm behind it
          // is real GPU cost repeated on every terminal, every frame.
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/70">
            <span className="rounded-full border border-neutral-700 bg-neutral-900/90 px-2.5 py-1 font-mono text-[10.5px] text-neutral-300">vendo o passado</span>
          </div>
        )}
      </div>
      {session && (
        <SessionPromptBar
          ref={promptRef} onSend={(text) => p.onSendTo(n.ref, text)} disabled={p.promptDisabled}
          restoreText={p.sendError?.text ?? null} onRestored={p.onDismissSendError}
        />
      )}
    </div>
  );
});
