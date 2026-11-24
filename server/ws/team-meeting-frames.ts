import { randomBytes } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { visibleMeeting } from '../../shared/team-meeting';
import { meetingTurn } from '../engine/triage';
import { getTeam } from '../team';
import { isTeamPaused } from '../team-log';
import { getMeetings, startMeeting, type MeetingDeps } from '../team-meetings';
import { broadcast, send } from './broadcast';
import { hasFreeRunSlot } from './runs';

export function liveMeetingDeps(): MeetingDeps {
  return {
    ask: meetingTurn,
    getTeam,
    isPaused: isTeamPaused,
    hasRoom: hasFreeRunSlot,
    publish: (m) => broadcast({ t: 'team-meeting', item: visibleMeeting(m) }),
    now: Date.now,
    newId: () => `m${Date.now().toString(36)}${randomBytes(2).toString('hex')}`,
  };
}

export async function sendMeetings(ws: WebSocket): Promise<void> {
  const items = (await getMeetings()).map(visibleMeeting).sort((a, b) => b.createdAt - a.createdAt);
  send(ws, { t: 'team-meetings', items });
}

export async function startMeetingFrame(ws: WebSocket, msg: Extract<ClientMsg, { t: 'team-meeting-start' }>, deps: MeetingDeps = liveMeetingDeps()): Promise<void> {
  const r = await startMeeting({ question: msg.question, participantIds: msg.participantIds, moderatorId: msg.moderatorId }, deps);
  if (!r.ok) send(ws, { t: 'error', message: r.error });
}
