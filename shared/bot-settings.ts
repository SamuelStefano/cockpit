export const BOT_SETTINGS_PATHS: readonly string[] = ['.claude/settings.json', '.claude/settings.local.json'];

export const isBotSettingsPath = (path: string): boolean => BOT_SETTINGS_PATHS.includes(path);

export type SettingsParse = { ok: true } | { ok: false; message: string; line: number };

// Line of the character at `pos` (1-based).
function lineAt(text: string, pos: number): number {
  let line = 1;
  for (let i = 0; i < Math.min(pos, text.length); i++) if (text[i] === '\n') line++;
  return line;
}

// Mirrors what the server enforces: the text must be one JSON value, and a settings
// file is an object.
export function parseSettingsText(text: string): SettingsParse {
  try {
    const v = JSON.parse(text) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, message: 'json inválido', line: 1 };
    return { ok: true };
  } catch (e) {
    // V8 reports a position, Firefox a line; Safari neither.
    const msg = e instanceof Error ? e.message : '';
    const pos = /position (\d+)/.exec(msg);
    const line = /line (\d+)/.exec(msg);
    return { ok: false, message: 'json inválido', line: pos ? lineAt(text, Number(pos[1])) : line ? Number(line[1]) : 1 };
  }
}

export const STUDENT_SETTINGS_ERROR = 'só regras deny/ask são editáveis';
const STUDENT_RULE_KEYS = new Set(['deny', 'ask']);

// A non-admin bot runs the restricted profile, whose containment is "anything
// outside the allow-list is denied": an `allow` rule or `additionalDirectories`
// in the workspace settings would be merged into that list and open the box.
// So a non-admin may only tighten: `permissions.deny` / `permissions.ask`, lists
// of strings, and nothing else (default-deny on every other key).
export function settingsDeniedForStudent(text: string): string | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return 'json inválido'; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'json inválido';
  const obj = v as Record<string, unknown>;
  if (Object.keys(obj).some((k) => k !== 'permissions')) return STUDENT_SETTINGS_ERROR;
  const perms = obj.permissions;
  if (perms === undefined) return null;
  if (!perms || typeof perms !== 'object' || Array.isArray(perms)) return 'json inválido';
  for (const [k, rules] of Object.entries(perms as Record<string, unknown>)) {
    if (!STUDENT_RULE_KEYS.has(k)) return STUDENT_SETTINGS_ERROR;
    if (!Array.isArray(rules) || rules.some((r) => typeof r !== 'string')) return 'json inválido';
  }
  return null;
}
