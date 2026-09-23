import { lazy, Suspense } from 'react';
import type { CanvasNode } from '../../../shared/canvas';
import { Button, Icon } from '../../components/primitives';
import type { TermApi } from '../../useCockpit';
import type { TermTarget } from './useCanvasTerms';

const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface Props {
  node: CanvasNode;
  target: TermTarget;
  term: TermApi;
  onClose: () => void;
}

// Screen-space copy of one canvas terminal at 100%: under the map's CSS scale
// xterm maps mouse selection to the wrong cells, so real work happens here.
export function TerminalMaximized({ node, target, term, onClose }: Props) {
  return (
    <div data-canvas-overlay className="absolute inset-2 z-30 flex flex-col overflow-hidden rounded-lg border border-orange-500/60 bg-[#0a0a0a] shadow-2xl shadow-black/70">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-800 bg-neutral-900 pl-3 pr-1">
        <Icon name="terminal" size={13} className="text-orange-400" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-neutral-200">{node.title}</span>
        <span className="font-mono text-[10.5px] text-neutral-500">tmux cockpit-{target.termId}</span>
        <Button variant="ghost" size="sm" square icon="minimize" title="voltar pro canvas" onClick={onClose} />
      </header>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
          <XtermView id={target.termId} watch={target.watch} term={term} fontSize={13} />
        </Suspense>
      </div>
    </div>
  );
}
