import { useCallback, useEffect, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { TeamPanelPayload } from '../../shared/team-panel';
import { usePersisted } from '../lib/persist';
import { TEAM_PANEL_OPEN_DEFAULT, TEAM_PANEL_OPEN_KEY, TEAM_PANEL_RECORDING_DEFAULT, TEAM_PANEL_RECORDING_KEY } from '../lib/prefs';

export interface TeamPanelApi {
  panel: TeamPanelPayload | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  recording: boolean;
  setRecording: (v: boolean) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

// The recording flag only travels to the server, which redacts; nothing is filtered here.
export function useTeamPanel(send: (m: ClientMsg) => boolean, enabled = true): TeamPanelApi {
  const [panel, setPanel] = useState<TeamPanelPayload | null>(null);
  const [open, setOpen] = usePersisted(TEAM_PANEL_OPEN_KEY, TEAM_PANEL_OPEN_DEFAULT);
  const [recording, setRecording] = usePersisted(TEAM_PANEL_RECORDING_KEY, TEAM_PANEL_RECORDING_DEFAULT);

  useEffect(() => {
    if (!enabled || !open) return;
    send({ t: 'team-panel-get', recording });
  }, [enabled, open, recording, send]);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'team-panel') return false;
    setPanel(msg.panel);
    return true;
  }, []);

  return { panel, open: enabled && open, setOpen, recording, setRecording, onMsg };
}
