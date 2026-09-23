import { isCronPing } from '../../../shared/canvas';

// The execution panel's whole point is "who is working" — a background
// cleanup/reset/triage run is not a person the user is waiting on, so it's
// noise there even though "it's fine that it runs" (TL feedback, 2026-09-23).
//
// What we CAN'T do robustly: tell a cron-fired MARATHON session (real,
// substantial work the user explicitly scheduled — e.g. "Maratona Fable" in
// crons.json) apart from an interactive one by session metadata alone. Every
// cron fire is a brand-new transcript (fireCron never passes --resume — see
// server/ws/runs.ts), so the only thing that survives to the closed session's
// CanvasNode is its title/snippet, which is just the cron's raw prompt text —
// identical in shape to something the user could've typed by hand. Hiding
// every cron-launched session on that basis would bury real overnight work,
// which is the opposite of what an execution panel is for. So this only
// catches sessions that IDENTIFY themselves as automation/maintenance by
// title or first-message text — the known reset-ping crons (isCronPing,
// already the sidebar's own noise filter) plus explicit
// housekeeping/hibernate/cleanup phrasing. A cron that does real work reads
// as a normal session and stays visible, on purpose.
const AUTOMATION_TEXT_RE = /(mem[oó]ria|memory)[^.]{0,24}(limpeza|clean ?up|gc\b|housekeeping)|(limpeza|clean ?up)[^.]{0,24}(mem[oó]ria|memory)|memory[- ]?gc|housekeeping|hibern(a|ar|ação|ate)|manuten[cç][aã]o autom[aá]tica|triagem autom[aá]tica|maintenance run/i;

export interface AutomationCheckInput {
  title: string;
  subtitle: string;
}

export function isAutomationSession(n: AutomationCheckInput): boolean {
  if (isCronPing({ title: n.title, snippet: n.subtitle })) return true;
  return AUTOMATION_TEXT_RE.test(n.title) || AUTOMATION_TEXT_RE.test(n.subtitle);
}
