import type { CronSchedule } from './protocol';
import { dayAllowed, midnightInTz, CRON_TZ_OFFSET_MIN } from './cron-schedule';

export const MIN_INTERVAL_MINUTES = 5;
const DAY = 86_400_000;
const MIN = 60_000;
const NOT_UNDERSTOOD = "Não entendi — tente 'toda sexta às 17h'";

export type ParseResult =
  | { ok: true; schedule: CronSchedule; cron: string | null; summary: string }
  | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[,;.!]/g, ' ').replace(/\s+/g, ' ').trim();
}

const DAY_NAMES = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const NAME = `(${DAY_NAMES.join('|')})s?(?:[ -]feiras?)?`;
const RANGE_RE = new RegExp(`\\b${NAME}\\s+(?:a|ate)\\s+${NAME}\\b`);
const LIST_RE = new RegExp(`\\b${NAME}\\b`, 'g');
const PLURAL = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];
const SINGULAR = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

interface Clock { minute: number; rest: string }

function extractClock(t: string): Clock | 'invalid' | null {
  let m: RegExpExecArray | null;
  let minute: number | null = null;
  let rest = t;
  let period = true;
  if ((m = /\bmeio[ -]?dia\b/.exec(t))) { minute = 720; period = false; }
  else if ((m = /\bmeia[ -]?noite\b/.exec(t))) { minute = 0; period = false; }
  else if ((m = /\b(\d{1,2}):(\d{2})\b/.exec(t))) minute = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /\b(\d{1,2}) ?h ?(\d{2})?(?![a-z])/.exec(t))) minute = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = /\bas (\d{1,2})\b(?: ?horas?\b)?( e meia\b)?/.exec(t))) minute = Number(m[1]) * 60 + (m[2] ? 30 : 0);
  else if ((m = /\b(\d{1,2}) ?horas\b( e meia\b)?/.exec(t))) minute = Number(m[1]) * 60 + (m[2] ? 30 : 0);
  if (minute === null || !m) return null;
  rest = rest.replace(m[0], ' ');
  if (minute >= 1440 || minute % 60 > 59 || (m[2] !== undefined && m[0].includes(':') && Number(m[2]) > 59)) return 'invalid';
  const p = period ? /\b(?:da|de|pela|a) (manha|tarde|noite|madrugada)\b/.exec(rest) : null;
  if (p) {
    rest = rest.replace(p[0], ' ');
    let h = Math.floor(minute / 60);
    if ((p[1] === 'tarde' || p[1] === 'noite') && h < 12) h += 12;
    else if (p[1] === 'noite' && h === 12) h = 0;
    minute = h * 60 + (minute % 60);
  }
  return { minute, rest };
}

function intervalMinutes(t: string): { minutes: number; rest: string } | 'invalid' | null {
  let m: RegExpExecArray | null;
  if ((m = /\b(?:a cada meia hora|de meia em meia hora)\b/.exec(t))) return { minutes: 30, rest: t.replace(m[0], ' ') };
  if ((m = /\b(?:a cada hora|de hora em hora)\b/.exec(t))) return { minutes: 60, rest: t.replace(m[0], ' ') };
  if ((m = /\ba cada (\d+) ?(min(?:utos?)?|h(?:oras?)?)\b/.exec(t))) {
    const n = Number(m[1]);
    const minutes = m[2].startsWith('h') ? n * 60 : n;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 100_000) return 'invalid';
    return { minutes, rest: t.replace(m[0], ' ') };
  }
  return null;
}

function weekdaysIn(t: string): number[] | null {
  if (/\b(?:fins?|finais) de semana\b/.test(t)) return WEEKEND;
  if (/\b(?:dias? (?:uteis|util)|uteis|util)\b/.test(t)) return WEEKDAYS;
  const r = RANGE_RE.exec(t);
  if (r) {
    const from = DAY_NAMES.indexOf(r[1]);
    const to = DAY_NAMES.indexOf(r[2]);
    const out: number[] = [];
    for (let i = from; ; i = (i + 1) % 7) { out.push(i); if (i === to) break; }
    return out.sort((a, b) => a - b);
  }
  const found = new Set<number>();
  for (const x of t.matchAll(LIST_RE)) found.add(DAY_NAMES.indexOf(x[1]));
  return found.size ? [...found].sort((a, b) => a - b) : null;
}

function compressDays(days: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < days.length;) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1) j++;
    if (j - i >= 2) out.push(`${days[i]}-${days[j]}`);
    else for (let k = i; k <= j; k++) out.push(String(days[k]));
    i = j + 1;
  }
  return out.join(',');
}

function cronOf(s: CronSchedule): string | null {
  if (s.kind === 'interval') {
    const m = s.everyMinutes ?? 0;
    if (m < 60 && m > 0 && 60 % m === 0) return `*/${m} * * * *`;
    if (m % 60 === 0 && m / 60 < 24 && 24 % (m / 60) === 0) return m === 60 ? '0 * * * *' : `0 */${m / 60} * * *`;
    return null;
  }
  if (s.kind === 'once') {
    const d = new Date((s.atMs ?? 0) + CRON_TZ_OFFSET_MIN * MIN);
    return `${d.getUTCMinutes()} ${d.getUTCHours()} ${d.getUTCDate()} ${d.getUTCMonth() + 1} *`;
  }
  const at = s.atMinute ?? 540;
  const dow = s.weekdays?.length && s.weekdays.length < 7 ? compressDays(s.weekdays) : '*';
  return `${at % 60} ${Math.floor(at / 60)} ${s.monthDay ?? '*'} * ${dow}`;
}

function listWords(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function intervalWords(m: number): string {
  if (m === 60) return 'a cada hora';
  if (m % 60 === 0) return `a cada ${m / 60} horas`;
  return `a cada ${m} minutos`;
}

function onceStamp(atMs: number): string {
  const d = new Date(atMs + CRON_TZ_OFFSET_MIN * MIN);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function scheduleSummary(s: CronSchedule): string {
  if (s.kind === 'interval') return intervalWords(s.everyMinutes ?? 60);
  if (s.kind === 'once') return `uma vez, ${onceStamp(s.atMs ?? 0)}`;
  const time = hhmm(s.atMinute ?? 540);
  if (s.monthDay) return `todo dia ${s.monthDay}, ${time}`;
  const wd = s.weekdays ?? [];
  if (!wd.length || wd.length === 7) return `todo dia, ${time}`;
  if (same(wd, WEEKDAYS)) return `dias úteis, ${time}`;
  if (same(wd, WEEKEND)) return `fins de semana, ${time}`;
  return `${listWords(wd.map((d) => PLURAL[d]))}, ${time}`;
}

function clockText(min: number): string {
  return min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${pad(min % 60)}`;
}

export function scheduleToText(s: CronSchedule): string {
  if (s.kind === 'interval') return intervalWords(s.everyMinutes ?? 60);
  if (s.kind === 'once') return scheduleSummary(s);
  const at = ` às ${clockText(s.atMinute ?? 540)}`;
  if (s.monthDay) return `todo dia ${s.monthDay}${at}`;
  const wd = s.weekdays ?? [];
  if (!wd.length || wd.length === 7) return `todo dia${at}`;
  if (same(wd, WEEKDAYS)) return `todo dia útil${at}`;
  if (same(wd, WEEKEND)) return `fins de semana${at}`;
  return `${wd[0] === 0 || wd[0] === 6 ? 'todo' : 'toda'} ${listWords(wd.map((d) => SINGULAR[d]))}${at}`;
}

function build(schedule: CronSchedule): ParseResult {
  return { ok: true, schedule, cron: cronOf(schedule), summary: scheduleSummary(schedule) };
}

const CRON_TEXT_RE = /^[\d*/,\- ]+$/;
const INT = /^\d+$/;

function dowList(field: string): number[] | null {
  if (field === '*') return [];
  const out = new Set<number>();
  for (const part of field.split(',')) {
    const r = /^(\d)(?:-(\d))?$/.exec(part);
    if (!r) return null;
    const a = Number(r[1]);
    const b = r[2] === undefined ? a : Number(r[2]);
    if (a > 7 || b > 7 || b < a) return null;
    for (let d = a; d <= b; d++) out.add(d % 7);
  }
  return [...out].sort((x, y) => x - y);
}

export function parseCronExpr(expr: string): ParseResult {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return fail('Cron precisa de 5 campos — ex: 0 9 * * 1-5');
  const [mi, h, dom, mon, dow] = f;
  const bad = fail('Esse cron não cabe numa rotina — tente "toda sexta às 17h".');
  const step = /^\*\/(\d+)$/;
  if (step.test(mi) && h === '*' && dom === '*' && mon === '*' && dow === '*') {
    const n = Number(step.exec(mi)?.[1]);
    return n >= MIN_INTERVAL_MINUTES && n < 60 ? build({ kind: 'interval', everyMinutes: n }) : fail(`O intervalo mínimo é ${MIN_INTERVAL_MINUTES} min.`);
  }
  if (mi === '0' && h === '*' && dom === '*' && mon === '*' && dow === '*') return build({ kind: 'interval', everyMinutes: 60 });
  if (mi === '0' && step.test(h) && dom === '*' && mon === '*' && dow === '*') {
    const n = Number(step.exec(h)?.[1]);
    return n >= 1 && n < 24 ? build({ kind: 'interval', everyMinutes: n * 60 }) : bad;
  }
  if (!INT.test(mi) || !INT.test(h) || Number(mi) > 59 || Number(h) > 23 || mon !== '*') return bad;
  const atMinute = Number(h) * 60 + Number(mi);
  const days = dowList(dow);
  if (!days) return bad;
  if (dom !== '*') {
    if (!INT.test(dom) || Number(dom) < 1 || Number(dom) > 31 || days.length) return bad;
    return build({ kind: 'daily', atMinute, monthDay: Number(dom) });
  }
  return build(days.length && days.length < 7 ? { kind: 'daily', atMinute, weekdays: days } : { kind: 'daily', atMinute });
}

export function parseScheduleText(text: string, now: number): ParseResult {
  if (CRON_TEXT_RE.test(text.trim()) && text.trim().split(/\s+/).length > 1) return parseCronExpr(text);
  const t = normalize(text);
  if (!t) return fail(`Escreva quando a rotina roda — tente 'toda sexta às 17h'`);

  const iv = intervalMinutes(t);
  if (iv === 'invalid') return fail(`O intervalo mínimo é ${MIN_INTERVAL_MINUTES} min.`);
  if (iv) {
    if (iv.minutes < MIN_INTERVAL_MINUTES) return fail(`O intervalo mínimo é ${MIN_INTERVAL_MINUTES} min.`);
    if (extractClock(iv.rest)) return fail(NOT_UNDERSTOOD);
    return build({ kind: 'interval', everyMinutes: iv.minutes });
  }

  const rel = /\bem (\d+) ?(min(?:utos?)?|h(?:oras?)?)\b/.exec(t);
  if (rel) {
    const n = Number(rel[1]) * (rel[2].startsWith('h') ? 60 : 1);
    if (n < 1) return fail(NOT_UNDERSTOOD);
    return build({ kind: 'once', atMs: now + n * MIN });
  }

  const clock = extractClock(t);
  if (clock === 'invalid') return fail('Hora inválida — use algo como 9h ou 14h30.');
  const rest = clock ? clock.rest : t;

  const tomorrow = /\bamanha\b/.test(rest);
  const today = /\bhoje\b/.test(rest);
  if (tomorrow || today) {
    if (!clock) return fail(`Faltou a hora — tente '${tomorrow ? 'amanhã' : 'hoje'} às 9h'.`);
    const atMs = midnightInTz(now) + (tomorrow ? DAY : 0) + clock.minute * MIN;
    if (atMs <= now) return fail('Esse horário de hoje já passou — tente "amanhã às 9h".');
    return build({ kind: 'once', atMs });
  }

  const weekdays = weekdaysIn(rest);
  const dm = /\bdia (\d{1,2})\b/.exec(rest);
  const everyDay = /\b(?:todo dia|todos os dias|diari\w*|cada dia|todo santo dia)\b/.test(rest);
  if (weekdays && dm) return fail(NOT_UNDERSTOOD);
  if (!weekdays && !dm && !everyDay) return fail(NOT_UNDERSTOOD);
  if (dm) {
    const day = Number(dm[1]);
    if (day < 1 || day > 31) return fail('Dia do mês inválido — use de 1 a 31.');
  }
  if (!clock) return fail(`Faltou a hora — tente '${weekdays ? 'toda sexta às 17h' : 'todo dia às 9h'}'.`);

  const schedule: CronSchedule = { kind: 'daily', atMinute: clock.minute };
  if (dm) schedule.monthDay = Number(dm[1]);
  else if (weekdays && weekdays.length < 7) schedule.weekdays = weekdays;
  return build(schedule);
}

export function nextRuns(s: CronSchedule, from: number, count: number): number[] {
  if (s.kind === 'once') return (s.atMs ?? 0) > from ? [s.atMs as number] : [];
  if (s.kind === 'interval') {
    const every = Math.max(1, s.everyMinutes ?? 60) * MIN;
    return Array.from({ length: count }, (_, i) => from + (i + 1) * every);
  }
  const base = midnightInTz(from);
  const at = (s.atMinute ?? 540) * MIN;
  const out: number[] = [];
  for (let k = 0; k <= 800 && out.length < count; k++) {
    const day = base + k * DAY;
    if (dayAllowed(s, day) && day + at > from) out.push(day + at);
  }
  return out;
}
