import type { TeamMascot } from '../../../../shared/protocol';
import type { TeamBotStatus } from '../../../../shared/team-state';
import type { TeamPanelPayload } from '../../../../shared/team-panel';

export interface PanelBotView { id?: string; name: string; mascot?: TeamMascot; status: TeamBotStatus; line: string | null }
export interface PanelNeedView extends PanelBotView { ageHours: number | null }
export interface PanelSectorView {
  name: string;
  bots: PanelBotView[];
  openPrs: number;
  mergedToday: number;
  blocker: string | null | undefined;
}
export interface PanelView { needs: PanelNeedView[]; sectors: PanelSectorView[] }

const HOUR_MS = 3_600_000;
const ageOf = (now: number, at?: number): number | null => (at ? Math.max(1, Math.floor((now - at) / HOUR_MS)) : null);

export function toPanelView(p: TeamPanelPayload): PanelView {
  if (p.redacted) {
    const known = new Map(p.sectors.flatMap((s) => s.bots).map((b) => [b.name, b]));
    return {
      needs: p.needs.map((n) => {
        const b = known.get(n.botName);
        return { name: n.botName, mascot: b?.mascot, status: b?.status ?? 'waiting', line: null, ageHours: ageOf(p.at, n.at) };
      }),
      sectors: p.sectors.map((s) => ({
        name: s.name,
        bots: s.bots.map((b) => ({ name: b.name, mascot: b.mascot, status: b.status, line: null })),
        openPrs: s.openPrs,
        mergedToday: s.mergedPrs,
        blocker: s.blockers > 0 ? null : undefined,
      })),
    };
  }
  const known = new Map(p.sectors.flatMap((s) => s.bots).map((b) => [b.id, b]));
  return {
    needs: p.needsYou.map((n) => {
      const b = n.botId ? known.get(n.botId) : undefined;
      return { id: n.botId, name: n.botName, mascot: b?.mascot, status: b?.status ?? 'waiting', line: n.text, ageHours: ageOf(p.at, n.at) };
    }),
    sectors: p.sectors.map((s) => {
      const first = s.bots.flatMap((b) => b.needs.filter((n) => n.kind === 'blocker').map((n) => `${b.name}: ${n.text}`))[0]
        ?? s.openPrs.find((x) => x.blocker)?.title;
      return {
        name: s.name,
        bots: s.bots.map((b) => ({ id: b.id, name: b.name, mascot: b.mascot, status: b.status, line: b.task ?? (b.status === 'idle' ? 'Ociosa' : '') })),
        openPrs: s.openPrs.length + s.bots.reduce((n, b) => n + b.openPrs.length, 0),
        mergedToday: s.mergedPrs.length + s.bots.reduce((n, b) => n + b.mergedPrs.length, 0),
        blocker: first,
      };
    }),
  };
}
