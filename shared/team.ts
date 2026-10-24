import type { Effort, MascotShape, PermMode, TeamBot, TeamBotInput, TeamProfile } from './protocol';

export const MAX_BOTS = 50;
export const MAX_NAME = 40;
export const MAX_LABEL = 60;
export const MAX_INSTRUCTIONS_BYTES = 8 * 1024;

const ID_RE = /^[a-z0-9]{4,24}$/;
const NAME_RE = new RegExp(`^[\\p{L}\\p{N}][\\p{L}\\p{N}_.-]{0,${MAX_NAME - 1}}$`, 'u');
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SHAPES: ReadonlySet<MascotShape> = new Set(['drop', 'blob', 'tri', 'bean']);
const PROFILES: ReadonlySet<TeamProfile> = new Set(['full', 'restricted']);
const MODES: ReadonlySet<PermMode> = new Set(['plan', 'auto', 'acceptEdits']);
const EFFORTS: ReadonlySet<Effort> = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/;

export const BOT_KEY_PREFIX = 'bot-';
// The browser opens a bot's first turn under a `new-bot-<id>` draft key so the
// existing new-→sessionId migration in useCockpit applies unchanged; server-side
// turns (fatias B/D) use the bare `bot-<id>`.
export const botDraftKey = (id: string) => `new-${BOT_KEY_PREFIX}${id}`;
export const botThreadKey = (id: string) => `${BOT_KEY_PREFIX}${id}`;
export function botIdFromKey(key: string): string | undefined {
  const m = /^(?:new-)?bot-([a-z0-9]{4,24})$/.exec(key);
  return m?.[1];
}

export function newBotId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export type BotValidation = { ok: true; bot: TeamBotInput } | { ok: false; error: string };

// Edge validation of a raw frame: only a well-formed bot reaches the store. Unknown
// fields are dropped so the browser can never smuggle sessionId/createdAt in.
export function validateBotInput(raw: unknown): BotValidation {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'bot inválido' };
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id || !ID_RE.test(id)) return { ok: false, error: 'id inválido' };
  const name = str(r.name)?.trim();
  if (!name || !NAME_RE.test(name)) return { ok: false, error: `nome inválido (letras, números, - _ . e até ${MAX_NAME} caracteres)` };
  const label = (str(r.label) ?? '').trim();
  if (label.length > MAX_LABEL) return { ok: false, error: `cargo passa de ${MAX_LABEL} caracteres` };
  const instructions = str(r.instructions) ?? '';
  if (new TextEncoder().encode(instructions).length > MAX_INSTRUCTIONS_BYTES) return { ok: false, error: 'instruções passam de 8KB' };
  const m = r.mascot as Record<string, unknown> | undefined;
  const shape = str(m?.shape) as MascotShape | undefined;
  const color = str(m?.color);
  if (!shape || !SHAPES.has(shape)) return { ok: false, error: 'forma do mascote inválida' };
  if (!color || !HEX_RE.test(color)) return { ok: false, error: 'cor do mascote inválida' };
  const profile = str(r.profile) as TeamProfile | undefined;
  if (!profile || !PROFILES.has(profile)) return { ok: false, error: 'perfil inválido' };
  const parentId = str(r.parentId) || undefined;
  if (parentId !== undefined && !ID_RE.test(parentId)) return { ok: false, error: 'chefe inválido' };
  if (parentId === id) return { ok: false, error: 'um bot não pode ser chefe de si mesmo' };
  const model = str(r.model) || undefined;
  if (model !== undefined && !MODEL_RE.test(model)) return { ok: false, error: 'modelo inválido' };
  const mode = str(r.mode) as PermMode | undefined;
  if (mode !== undefined && !MODES.has(mode)) return { ok: false, error: 'modo inválido' };
  const effort = str(r.effort) as Effort | undefined;
  if (effort !== undefined && !EFFORTS.has(effort)) return { ok: false, error: 'esforço inválido' };
  const bot: TeamBotInput = { id, name, label, instructions, mascot: { shape, color: color.toLowerCase() }, profile };
  if (parentId) bot.parentId = parentId;
  if (r.primary === true) bot.primary = true;
  if (model) bot.model = model;
  if (mode) bot.mode = mode;
  if (effort) bot.effort = effort;
  return { ok: true, bot };
}

// True when giving `id` the parent `parentId` would close a loop in the chain.
export function wouldCycle(bots: Pick<TeamBot, 'id' | 'parentId'>[], id: string, parentId: string | undefined): boolean {
  const parentOf = new Map(bots.map((b) => [b.id, b.parentId]));
  let cur = parentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === id) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = parentOf.get(cur);
  }
  return false;
}
