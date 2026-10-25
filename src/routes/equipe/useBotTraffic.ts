import { useMemo } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import { groupTeamTraffic, type TeamMessage } from '../../../shared/team-messages';
import type { Message } from '../../data/types';
import { threadAnchors } from './team-thread';

export function useBotTraffic(botId: string, bots: TeamBot[], log: TeamMessage[], messages: Message[]) {
  const byId = useMemo(() => new Map(bots.map((b) => [b.id, b])), [bots]);
  const anchors = useMemo(() => threadAnchors(messages), [messages]);
  const groups = useMemo(() => groupTeamTraffic(botId, log, anchors), [botId, log, anchors]);
  return { byId, groups };
}
