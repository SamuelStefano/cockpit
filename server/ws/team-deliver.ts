import type { TeamBot } from '../../shared/protocol';
import { botThreadKey } from '../../shared/team';
import { botName, teamPrompt } from '../../shared/team-messages';
import { botTurnParams, botDenyRules } from '../team-prompt';
import { readMemoriesSafe } from '../memories';
import { startTeamOutbox, type Delivery, type SpoolMessage } from '../team-outbox';
import { getTeam } from '../team';
import { broadcast } from './broadcast';
import { hasInteractiveClaude } from '../canvas/term-stats';
import { readBusyElsewhereSessionIds } from '../canvas/cv-liveness';
import { enqueuePending } from './pending';
import { addParked } from './parked';
import { resumableId } from './resume';
import { botLiveKey, isDrainerEnabled, startRun } from './runs';
import { threads, type RunParams } from './threads';

function park(key: string, params: RunParams, prompt: string, resumeId: string | undefined): Delivery {
  try { return 'reject' in addParked(key, { ...params, prompt, resumeId }) ? 'failed' : 'queued'; }
  catch { return 'failed'; }
}

// A team message becomes a server turn in the recipient's one thread, through the
// same paths a user message takes: a live turn means the existing queues, an idle
// one means startRun with the bot's identity and its bound session resumed.
// Like a routine (fireBotRoutine), it runs under `bot-<id>`; the browser aliases
// that key to the bot's thread.
export async function deliverTeamMessage(m: SpoolMessage, team: TeamBot[]): Promise<Delivery> {
  const turn = botTurnParams(team, botThreadKey(m.to), undefined, await readMemoriesSafe());
  if (!turn) return 'failed';
  const resume = resumableId(turn.resumeId);
  const key = botThreadKey(m.to);
  // The drainer finds a live turn by key or by session id, so a disk item keyed
  // by the session still waits for a tab's turn on it.
  const parkKey = resume ?? key;
  const prompt = teamPrompt(botName(team, m.from), m.text);
  const params: RunParams = {
    mode: turn.mode, model: turn.model, effort: turn.effort ?? 'low',
    botId: turn.botId, appendSystemPrompt: turn.appendSystemPrompt, teamHop: m.hop,
    // Without this a restricted bot woken by a team message would run unlocked.
    profile: turn.profile,
    ...(await botDenyRules(turn).then((d) => (d.length ? { disallowedSkills: d } : {}))),
  };
  const queueLive = (live: string): Delivery => {
    // Only the drainer's process ticks parked.json; elsewhere the in-turn queue,
    // drained by this process's own onClose, is the one that moves.
    if (isDrainerEnabled()) return park(resume ?? live, params, prompt, resume);
    return enqueuePending(live, { ...params, ws: null, prompt, merge: false }) ? 'queued' : 'failed';
  };
  const live = botLiveKey(m.to, resume);
  if (live) return queueLive(live);
  // Driven by an interactive claude or by the other Deck process: a run here would
  // be a second writer on the transcript. The disk queue waits for it to go idle.
  if (resume && (await hasInteractiveClaude(resume) || (await readBusyElsewhereSessionIds().catch(() => [] as string[])).includes(resume))) {
    return park(parkKey, params, prompt, resume);
  }
  const raced = botLiveKey(m.to, resume);
  if (raced) return queueLive(raced);
  const r = startRun({ ...params, ws: null, sessionKey: key, prompt, resumeId: resume, msgId: `team-${m.id}` });
  if (r === 'pane' || threads.has(key)) return 'delivered';
  if (r === 'rejected') return park(parkKey, params, prompt, resume);
  return 'failed';
}

// Both Deck processes run this: the rename claim picks who delivers, and each
// process broadcasts from the shared log so every tab sees every message.
export function startTeamMessaging(): void {
  startTeamOutbox({ getTeam, deliver: deliverTeamMessage }, (item) => broadcast({ t: 'team-message', item }));
}
