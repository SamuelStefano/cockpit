import type { WebSocket } from 'ws';
import { clearPendingQuestion, questionsIn, readPendingQuestions, setPendingQuestion } from '../team-pending';
import { broadcast, send } from './broadcast';

export function sendTeamPending(ws: WebSocket): void {
  send(ws, { t: 'team-pending', items: readPendingQuestions() });
}

// Disk trouble must not break the turn: the question still shows from the
// transcript in the open thread, only the roster/badge would miss it.
export function recordBotQuestion(botId: string, sessionKey: string, content: unknown, now = Date.now()): void {
  const questions = questionsIn(content);
  if (!questions) return;
  try { broadcast({ t: 'team-pending', items: setPendingQuestion({ botId, sessionKey, questions, at: now }) }); } catch { /* see above */ }
}

export function clearBotQuestion(botId: string): void {
  try {
    const items = clearPendingQuestion(botId);
    if (items) broadcast({ t: 'team-pending', items });
  } catch { /* see recordBotQuestion */ }
}
