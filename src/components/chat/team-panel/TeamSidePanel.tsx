import { useState } from 'react';
import type { TeamPanelApi } from '../../../cockpit/useTeamPanel';
import { Drawer } from '../../primitives/Drawer';
import { Switch } from '../../primitives/Switch';
import { TeamPanelDetailModal } from './TeamPanelDetailModal';
import { TeamPanelRedacted } from './TeamPanelRedacted';
import { TeamPanelSectors } from './TeamPanelSectors';
import type { PanelDetail } from './panel-detail';

function Body({ api }: { api: TeamPanelApi }) {
  const [detail, setDetail] = useState<PanelDetail | null>(null);
  const { panel } = api;
  return (
    <div className="space-y-4 p-3 text-[14px] leading-5">
      <Switch checked={api.recording} onChange={() => api.setRecording(!api.recording)} label="Recording mode" hint="Names, status and counts only" />
      {!panel && <p className="text-neutral-600">Loading…</p>}
      {panel?.redacted === true && <TeamPanelRedacted panel={panel} />}
      {panel?.redacted === false && <TeamPanelSectors panel={panel} onOpen={setDetail} />}
      {panel?.redacted === false && panel.prsError && <p className="text-[12px] text-yellow-500">PRs unavailable: {panel.prsError}</p>}
      <TeamPanelDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function TeamSidePanel({ api, isMobile }: { api: TeamPanelApi; isMobile: boolean }) {
  if (!api.open) return null;
  if (isMobile) {
    return <Drawer open onClose={() => api.setOpen(false)} title="Team panel" side="right"><Body api={api} /></Drawer>;
  }
  return (
    <aside aria-label="Team panel" className="scroll-thin h-full w-80 shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-950">
      <Body api={api} />
    </aside>
  );
}
