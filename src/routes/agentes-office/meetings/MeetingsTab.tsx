import { useEffect, useRef, useState } from 'react';
import type { TeamBot } from '../../../../shared/protocol';
import type { MeetingInput, TeamMeeting } from '../../../../shared/team-meeting';
import { Button } from '../../../components/primitives';
import { MeetingList } from './MeetingList';
import { MeetingView } from './MeetingView';
import { NewMeetingForm } from './NewMeetingForm';

interface MeetingsTabProps {
  meetings: TeamMeeting[];
  bots: TeamBot[];
  connected: boolean;
  canEdit: boolean;
  onGet: () => void;
  onStart: (input: MeetingInput) => void;
}

type Screen = { kind: 'list' } | { kind: 'new' } | { kind: 'meeting'; id: string };

export function MeetingsTab({ meetings, bots, connected, canEdit, onGet, onStart }: MeetingsTabProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const known = useRef<Set<string> | null>(null);
  useEffect(() => { if (connected && canEdit) onGet(); }, [connected, canEdit, onGet]);
  useEffect(() => {
    if (!known.current) return;
    const fresh = meetings.find((m) => !known.current!.has(m.id));
    if (fresh) { known.current = null; setScreen({ kind: 'meeting', id: fresh.id }); }
  }, [meetings]);

  const open = screen.kind === 'meeting' ? meetings.find((m) => m.id === screen.id) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {screen.kind === 'list' && (
        <>
          <div className="flex items-center gap-3">
            <p className="mr-auto min-w-0 text-[14px] text-neutral-400">Os agentes respondem às cegas, depois se veem e revisam. No fim, uma ata para você.</p>
            <Button variant="primary" size="sm" icon="plus" onClick={() => setScreen({ kind: 'new' })}>Nova reunião</Button>
          </div>
          <MeetingList meetings={meetings} bots={bots} onOpen={(id) => setScreen({ kind: 'meeting', id })} />
        </>
      )}
      {screen.kind === 'new' && (
        <NewMeetingForm
          bots={bots} canEdit={canEdit} onCancel={() => setScreen({ kind: 'list' })}
          onStart={(input) => { known.current = new Set(meetings.map((m) => m.id)); onStart(input); setScreen({ kind: 'list' }); }}
        />
      )}
      {screen.kind === 'meeting' && (
        <>
          <div><Button variant="ghost" size="xs" icon="chevronLeft" onClick={() => setScreen({ kind: 'list' })}>Reuniões</Button></div>
          {open ? <MeetingView meeting={open} bots={bots} /> : <p className="text-[14px] text-neutral-400">Reunião não encontrada.</p>}
        </>
      )}
    </div>
  );
}
