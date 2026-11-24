#!/usr/bin/env -S npx tsx
// Sets `home` + `homeSeat` on every team bot from a homes file, through the Deck server
// (team-save frames). Never writes ~/.cockpit/team.json directly.
//
// Run: npx tsx scripts/apply-team-homes.mts [file] [--dry]
// The file defaults to scripts/team-homes.json: {"homes": {"<slug>": {"house": "<id>", "seat": <n>}}}
// where slug is the bot name lowercased without accents (Íris -> iris).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TeamBot, TeamBotInput } from '../shared/protocol';
import { HOME_RE, MAX_HOME_SEAT } from '../shared/team';
import { Client, connect, fetchTeam, mutationAck, fail } from './deckctl.mts';
import type { ServerMsg } from '../shared/protocol';

export interface HomeEntry { house: string; seat: number }
export interface HomesFile { homes: Record<string, HomeEntry> }

export const slugify = (name: string): string => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function parseHomesFile(raw: string): HomesFile {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error('homes file is not valid JSON'); }
  const homes = (data as { homes?: unknown } | null)?.homes;
  if (!homes || typeof homes !== 'object' || Array.isArray(homes)) throw new Error('homes file needs a "homes" object');
  const out: Record<string, HomeEntry> = {};
  for (const [slug, v] of Object.entries(homes)) {
    const e = v as { house?: unknown; seat?: unknown } | null;
    if (!e || typeof e.house !== 'string' || !HOME_RE.test(e.house)) throw new Error(`"${slug}": house must match ${HOME_RE}`);
    if (typeof e.seat !== 'number' || !Number.isInteger(e.seat) || e.seat < 0 || e.seat > MAX_HOME_SEAT) throw new Error(`"${slug}": seat must be an integer 0..${MAX_HOME_SEAT}`);
    out[slug] = { house: e.house, seat: e.seat };
  }
  return { homes: out };
}

export interface HomeChange { botId: string; name: string; from: { home?: string; homeSeat?: number }; to: HomeEntry }
export interface HomePlan { changes: HomeChange[]; unchanged: string[]; unknownSlugs: string[]; botsWithoutHome: string[] }

export function planHomes(team: Pick<TeamBot, 'id' | 'name' | 'home' | 'homeSeat'>[], file: HomesFile): HomePlan {
  const bySlug = new Map(team.map((b) => [slugify(b.name), b]));
  const plan: HomePlan = { changes: [], unchanged: [], unknownSlugs: [], botsWithoutHome: [] };
  for (const [slug, to] of Object.entries(file.homes)) {
    const b = bySlug.get(slug);
    if (!b) { plan.unknownSlugs.push(slug); continue; }
    if (b.home === to.house && b.homeSeat === to.seat) plan.unchanged.push(b.name);
    else plan.changes.push({ botId: b.id, name: b.name, from: { home: b.home, homeSeat: b.homeSeat }, to });
  }
  plan.botsWithoutHome = team.filter((b) => !(slugify(b.name) in file.homes)).map((b) => b.name);
  return plan;
}

export const toInput = (b: TeamBot, to: HomeEntry): TeamBotInput => {
  const { sessionId: _s, createdAt: _c, updatedAt: _u, sourceSync: _y, ...rest } = b;
  return { ...rest, home: to.house, homeSeat: to.seat };
};

const fmt = (h: { home?: string; homeSeat?: number }): string => (h.home ? `${h.home}#${h.homeSeat ?? '-'}` : '(none)');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const file = resolve(args.find((a) => !a.startsWith('--')) ?? 'scripts/team-homes.json');
  let homes: HomesFile;
  try { homes = parseHomesFile(readFileSync(file, 'utf8')); } catch (e) { return fail(`${file}: ${(e as Error).message}`); }
  const client: Client = await connect();
  try {
    const team = await fetchTeam(client);
    const plan = planHomes(team, homes);
    for (const c of plan.changes) console.log(`${dry ? 'would set' : 'set'} ${c.name}: ${fmt(c.from)} -> ${c.to.house}#${c.to.seat}`);
    console.log(`${plan.changes.length} to change, ${plan.unchanged.length} already set`);
    if (plan.unknownSlugs.length) console.log(`slugs with no bot: ${plan.unknownSlugs.join(', ')}`);
    if (plan.botsWithoutHome.length) console.log(`bots not in the file: ${plan.botsWithoutHome.join(', ')}`);
    if (dry) return;
    for (const c of plan.changes) {
      const bot = team.find((b) => b.id === c.botId)!;
      client.send({ t: 'team-save', bot: toInput(bot, c.to) });
      await mutationAck(client, (m): m is Extract<ServerMsg, { t: 'team' }> => m.t === 'team' && m.bots.some((b) => b.id === c.botId && b.home === c.to.house && b.homeSeat === c.to.seat), `team-save ${c.name}`);
    }
  } finally {
    client.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
}
