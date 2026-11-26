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
    const m = /position (\d+)/.exec(e instanceof Error ? e.message : '');
    return { ok: false, message: 'json inválido', line: m ? lineAt(text, Number(m[1])) : 1 };
  }
}

const RISKY_MODES = new Set(['bypassPermissions', 'acceptEdits']);

// A non-admin bot runs the restricted profile: only permission rules may be
// edited, never hooks, env, helpers or a mode that skips the prompt.
export function settingsDeniedForStudent(text: string): string | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return 'json inválido'; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'json inválido';
  const obj = v as Record<string, unknown>;
  if (Object.keys(obj).some((k) => k !== 'permissions')) return 'só permissões são editáveis';
  const perms = obj.permissions;
  if (perms !== undefined && (!perms || typeof perms !== 'object' || Array.isArray(perms))) return 'json inválido';
  const mode = (perms as { defaultMode?: unknown } | undefined)?.defaultMode;
  if (typeof mode === 'string' && RISKY_MODES.has(mode)) return 'só permissões são editáveis';
  return null;
}
