import type { TeamPanelApi } from '../../../cockpit/useTeamPanel';
import { Icon } from '../../primitives';
import { HIDDEN, PanelCard } from './PanelCard';
import { toPanelView, type PanelBotView } from './panel-view';

export type OpenBot = (bot: { id?: string; name: string }) => void;

const Heading = ({ children, tone = 'text-neutral-500' }: { children: string; tone?: string }) => (
  <h4 className={`mb-2 mt-4 text-[11px] font-medium uppercase tracking-wider ${tone}`}>{children}</h4>
);

function Body({ api, onOpenBot }: { api: TeamPanelApi; onOpenBot: OpenBot }) {
  const { panel, recording } = api;
  const view = panel ? toPanelView(panel) : null;
  const open = (b: PanelBotView) => () => onOpenBot({ id: b.id, name: b.name });
  return (
    <div className="px-3.5 pb-3 text-[13px] leading-5">
      {!view && <p className="pt-3 text-neutral-600">Carregando…</p>}
      {view && view.needs.length > 0 && (
        <section aria-label="Precisa de você">
          <Heading tone="text-red-400">{`Precisa de você · ${view.needs.length}`}</Heading>
          <ul className="grid grid-cols-2 gap-2">
            {view.needs.map((n, i) => <li key={i} className="min-w-0"><PanelCard {...n} need onOpen={open(n)} /></li>)}
          </ul>
        </section>
      )}
      {view?.sectors.map((s) => (
        <section key={s.name} aria-label={s.name}>
          <div className="flex items-center justify-between">
            <Heading>{s.name}</Heading>
            {s.bots.length > 0 && <span className="mt-4 mb-2 text-[11px] uppercase tracking-wider text-neutral-500">{s.bots.length} bots</span>}
          </div>
          {s.bots.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {s.bots.map((b) => <li key={b.id ?? b.name} className="min-w-0"><PanelCard {...b} onOpen={open(b)} /></li>)}
            </ul>
          )}
          <p className="mt-2 text-neutral-400">
            <b className="text-neutral-100">{s.openPrs}</b> PRs abertas <b className="ml-2 text-neutral-100">{s.mergedToday}</b> mergeadas hoje
          </p>
          {s.blocker !== undefined && (
            <p className="mt-1 truncate text-red-400">⛔ {s.blocker === null ? HIDDEN : s.blocker}</p>
          )}
        </section>
      ))}
      {panel?.redacted === false && panel.prsError && <p className="mt-3 text-[12px] text-yellow-500">PRs indisponíveis: {panel.prsError}</p>}
    </div>
  );
}

export function TeamSidePanel({ api, isMobile, onOpenBot }: { api: TeamPanelApi; isMobile: boolean; onOpenBot: OpenBot }) {
  if (!api.open) return null;
  const header = (
    <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-4 py-3">
      <b className="text-[15px] text-neutral-100">Painel</b>
      <button
        type="button"
        aria-pressed={api.recording}
        onClick={() => api.setRecording(!api.recording)}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ${api.recording ? 'bg-red-500/15 text-red-300' : 'bg-neutral-800 text-neutral-400'}`}
      >
        <span className={`h-2 w-2 rounded-full ${api.recording ? 'bg-red-400' : 'bg-neutral-500'}`} />
        {api.recording ? 'Modo gravação ligado' : 'Modo gravação desligado'}
      </button>
      <button type="button" onClick={() => api.setOpen(false)} aria-label="Fechar painel" className="ml-auto cursor-pointer text-neutral-500 hover:text-neutral-200">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
  const body = <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"><Body api={api} onOpenBot={onOpenBot} /></div>;
  if (isMobile) {
    return (
      <aside aria-label="Painel" className="flex h-[60%] shrink-0 flex-col rounded-t-[18px] border-t border-neutral-700 bg-neutral-950">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-neutral-700" />
        {header}
        {body}
      </aside>
    );
  }
  return (
    <aside aria-label="Painel" className="flex h-full w-[400px] shrink-0 flex-col border-l border-neutral-800 bg-neutral-950">
      {header}
      {body}
    </aside>
  );
}
