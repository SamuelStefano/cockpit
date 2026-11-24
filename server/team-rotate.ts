import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import { checkHandoff } from '../shared/bot-handoff';
import type { TeamMessage } from '../shared/team-messages';
import { randomBytes } from 'node:crypto';
import { rotateBotSession, getTeam } from './team';
import { appendTeamLog } from './team-log';

export function handoffDir(): string {
  return process.env.COCKPIT_HANDOFFS ?? join(homedir(), '.cockpit', 'handoffs');
}

export function handoffPath(botId: string): string {
  return join(handoffDir(), `${botId}.md`);
}

export function readHandoffSync(botId: string): string | null {
  try { return readFileSync(handoffPath(botId), 'utf8'); } catch { return null; }
}

export type RotateOutcome = { ok: true; bots: TeamBot[]; words: number } | { ok: false; error: string };

export async function rotateBot(botId: string, isBusy: (bot: TeamBot) => boolean, now = Date.now()): Promise<RotateOutcome> {
  if (!(await getTeam()).some((b) => b.id === botId)) return { ok: false, error: 'bot não encontrado' };
  const text = await readFile(handoffPath(botId), 'utf8').catch(() => null);
  const check = checkHandoff(text);
  if (!check.ok) return check;
  const r = await rotateBotSession(botId, isBusy, now);
  if (!r.ok) return r;
  const entry: TeamMessage = {
    id: `m${randomBytes(8).toString('hex')}`, from: botId, to: botId, ts: now, status: 'delivered', hop: 1,
    text: `rotate: sessão zerada, o próximo turno começa com o handoff (${check.words} palavras)`,
  };
  await appendTeamLog(entry).catch(() => {});
  return { ok: true, bots: r.bots, words: check.words };
}

export function handoffPromptBlock(botId: string): string {
  const text = readHandoffSync(botId);
  if (!text || !checkHandoff(text).ok) return '';
  return `\n\nVocê acabou de trocar de sessão. Este é o handoff que você mesmo escreveu para continuar de onde parou (leia antes de agir):\n\n${text.trim()}`;
}
