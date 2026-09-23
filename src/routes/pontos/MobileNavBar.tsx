import type { ReactNode } from 'react';
import { Drawer, Icon, tokens } from '../../components/primitives';
import type { Selection } from './useWorkspace';
import { fmtPts } from './money';

interface Props {
  selection: Selection;
  open: boolean;
  onOpen: (v: boolean) => void;
  children: ReactNode;    // the navigator, rendered inside the drawer
}

const VIEW_LABEL = { faturas: 'Faturas', ledger: 'Ledger do agente' } as const;

// Phone: the navigator becomes a one-line selector ("which epic am I looking
// at") that opens it in a drawer.
export function MobileNavBar({ selection, open, onOpen, children }: Props) {
  const { draft, dfl, view, row } = selection;
  const title = draft?.title ?? dfl?.epic.name ?? (view ? VIEW_LABEL[view] : 'Escolha um épico');
  const kind = draft ? 'rascunho' : dfl ? dfl.project.name : 'visão';
  const pts = row?.points ?? dfl?.epic.points;
  return (
    <div className="border-b border-neutral-800/80 px-3 py-2 lg:hidden">
      <button type="button" onClick={() => onOpen(true)} aria-haspopup="dialog"
        className={`flex h-10 w-full items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 text-left ${tokens.focusRing}`}>
        <Icon name="layers" size={14} className="shrink-0 text-orange-400" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-mono text-[10px] lowercase text-neutral-500">{kind}</span>
          <span className="truncate text-[13px] font-medium text-neutral-100">{title}</span>
        </span>
        {pts != null && <span className="shrink-0 font-mono text-[12px] tabular-nums text-neutral-400">{fmtPts(pts)} pt</span>}
        <Icon name="chevronDown" size={14} className="shrink-0 text-neutral-500" />
      </button>
      <Drawer open={open} onClose={() => onOpen(false)} title="Épicos">
        <div className="flex h-full flex-col">{children}</div>
      </Drawer>
    </div>
  );
}
