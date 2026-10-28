import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { sanitizeBoxLabel } from '../shared/boxes';
import type { RosterBox } from '../shared/protocol';
import { CONFIG, projectSlug } from './config';

const MAX_ROSTER = 20;

export interface BoxRoster {
  at: number;
  boxes: RosterBox[];
}

export interface DeckContextInput {
  label: string;
  host: string;
  roster: BoxRoster | null;
  deckctl: boolean;
  deckGuide: boolean;
  bot: boolean;
  home: string;
  workdir: string;
}

export function rosterFile(env: NodeJS.ProcessEnv = process.env): string {
  return env.DECK_BOX_ROSTER_FILE ?? join(homedir(), '.cockpit', 'box-roster.json');
}

export function parseRoster(raw: unknown): RosterBox[] | null {
  if (!Array.isArray(raw)) return null;
  const boxes: RosterBox[] = [];
  for (const b of raw.slice(0, MAX_ROSTER) as Array<Partial<RosterBox> | null>) {
    const label = sanitizeBoxLabel(b?.label);
    if (label) boxes.push({ label, online: b?.online === true, self: b?.self === true });
  }
  return boxes;
}

export function saveRoster(boxes: RosterBox[], now = Date.now(), file = rosterFile()): void {
  const prev = loadRoster(file);
  if (prev && JSON.stringify(prev.boxes) === JSON.stringify(boxes)) return;
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ at: now, boxes }), { mode: 0o600 });
  renameSync(tmp, file);
}

export function loadRoster(file = rosterFile()): BoxRoster | null {
  try {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    const boxes = parseRoster(j?.boxes);
    return boxes && typeof j.at === 'number' ? { at: j.at, boxes } : null;
  } catch { return null; }
}

function onPath(bin: string, env: NodeJS.ProcessEnv): boolean {
  const dirs = [...(env.PATH ?? '').split(delimiter), join(homedir(), 'bin')];
  return dirs.some((d) => d && existsSync(join(d, bin)));
}

function boxesLines(input: DeckContextInput): string[] {
  const others = input.roster?.boxes.filter((b) => !b.self) ?? [];
  if (!input.roster) return ['- Other boxes: unknown (no Deck tab has reported the box list to this box yet).'];
  if (!others.length) return ['- Other boxes: none, this is the only box on the account.'];
  const when = new Date(input.roster.at).toISOString().slice(0, 16).replace('T', ' ');
  return [
    `- Other boxes on this account (as last seen by the Deck, ${when} UTC):`,
    ...others.map((b) => `  - ${b.label} (${b.online ? 'online' : 'offline'})`),
  ];
}

export function buildDeckContext(input: DeckContextInput): string {
  const memory = join(input.home, '.claude', 'projects', projectSlug(input.workdir), 'memory');
  const lines = [
    '# You are running inside the Deck',
    'The Deck is a web cockpit over Claude Code and other agent CLIs. The person talks to you from a browser (desktop or phone); the browser reaches this machine directly or through the Deck relay, and the Deck agent on this machine spawned you for this chat session. Each paired machine is a "box".',
    '',
    '## Where you are',
    `- Box: ${input.label} (hostname ${input.host}). Working directory: ${input.workdir}.`,
    ...boxesLines(input),
    '- Every box is separate: its own sessions, files, credentials and ~/.claude. Nothing you write here appears on another box.',
    '',
    '## What the person sees',
    '- A sidebar of sessions grouped by box, with a box switcher; this chat is one of them. Your text streams live; tool calls show as collapsed cards.',
    '- A kanban/canvas view of sessions as cards, and a queue: messages sent while you work are delivered after your turn ends.',
    '- A beep and a notification when your turn ends, so close every turn with a clear final message (what was done, what is left).',
    '- "Drop privado": for a secret (token, key, password), ask the person to put it in the private drop instead of pasting it in the chat; it lands in ~/.deck-drop/<name> on this box and never enters the transcript unless you Read it.',
    '- Images: save the file and cite it with a relative path, ![caption](file.png), and the chat renders it.',
    '',
    '## Acting on the Deck',
    input.deckctl
      ? '- `deckctl` is installed here: it drives this box\'s Deck from the shell (`deckctl sessions`, `read`, `new`, `send`, `wait`, `board`, `card`, `queue`, `status`). Run `deckctl` with no arguments for the full list.'
      : '- `deckctl` is not installed on this box, so you cannot list or start Deck sessions from the shell here.',
    input.bot
      ? '- You are an Equipe bot: the `deck-team` MCP gives you `team_list` and `team_send` to message the other bots of this box\'s team.'
      : '- The `deck-team` MCP (team_list/team_send) only loads in Equipe bot turns; this session does not have it.',
    '- There is no way yet to message a session or bot on another box. If asked, say so plainly; the person can switch box in the sidebar.',
    ...(input.deckGuide ? ['- For how-to questions about the Deck itself (setup, boxes, crons, drops, models), use the `deck-guide` skill.'] : []),
    '',
    '## Your own context (this box only)',
    `- Instructions: ${join(input.home, '.claude', 'CLAUDE.md')}. Skills: ${join(input.home, '.claude', 'skills')}/. Memory: ${memory}/.`,
    '- Other boxes keep their own copies; editing these files changes only this box.',
  ];
  return lines.join('\n');
}

export function deckContextEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DECK_AGENT_CONTEXT !== '0';
}

export function deckAgentContext(opts: { bot: boolean }, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!deckContextEnabled(env)) return undefined;
  const roster = loadRoster(rosterFile(env));
  const host = hostname();
  const self = roster?.boxes.find((b) => b.self)?.label;
  const home = homedir();
  return buildDeckContext({
    label: self || (env.DECK_BOX_LABEL ?? '').trim() || host,
    host,
    roster,
    deckctl: onPath('deckctl', env),
    deckGuide: existsSync(join(home, '.claude', 'skills', 'deck-guide', 'SKILL.md')),
    bot: opts.bot,
    home,
    workdir: CONFIG.workdir,
  });
}

export function joinSystemPrompts(...parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter((p): p is string => !!p?.trim());
  return kept.length ? kept.join('\n\n') : undefined;
}
