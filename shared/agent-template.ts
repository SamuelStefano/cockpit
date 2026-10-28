import type { MascotShape, TeamBot } from './protocol';
import { MAX_INSTRUCTIONS_BYTES, MAX_LABEL, MAX_NAME } from './team';
import { knownSkillFilter, sanitizeName } from './agent-builder';

export const TEMPLATE_KIND = 'deck-agent';
export const TEMPLATE_VERSION = 1;
export const MAX_TEMPLATE_BYTES = 24 * 1024;
const MAX_TEMPLATE_SKILLS = 40;
const SKILL_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SHAPES: ReadonlySet<string> = new Set<MascotShape>(['drop', 'blob', 'tri', 'bean']);
const LINK_PARAM = 'agente';

// Shape of a template. It carries what the agent IS, never where it lives or what
// it may do: no id, boss, session, model, mode or profile — those are the importing
// box's call, so a shared file can never widen anyone's permissions.
export interface AgentTemplate {
  kind: typeof TEMPLATE_KIND;
  v: typeof TEMPLATE_VERSION;
  name: string;
  label: string;
  instructions: string;
  mascot: { shape: MascotShape; color: string };
  skills: string[];
}

export type TemplateResult = { ok: true; template: AgentTemplate } | { ok: false; error: string };

const SECRET_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, what: 'uma chave privada' },
  { re: /\bsk-[A-Za-z0-9_-]{16,}/, what: 'uma chave de API' },
  { re: /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/, what: 'um token do GitHub' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: 'uma chave da AWS' },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, what: 'um token do Slack' },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, what: 'um token JWT' },
  { re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/i, what: 'um token de acesso' },
  { re: /\b(?:password|senha|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{8,}/i, what: 'uma senha ou chave' },
];

export function findSecret(...texts: string[]): string | null {
  for (const text of texts) for (const { re, what } of SECRET_PATTERNS) if (re.test(text)) return what;
  return null;
}

export function exportTemplate(bot: Pick<TeamBot, 'name' | 'label' | 'instructions' | 'mascot'> & { skills?: string[] }): TemplateResult {
  const secret = findSecret(bot.name, bot.label, bot.instructions);
  if (secret) return { ok: false, error: `as instruções parecem ter ${secret} — tire antes de compartilhar` };
  return {
    ok: true,
    template: {
      kind: TEMPLATE_KIND,
      v: TEMPLATE_VERSION,
      name: bot.name,
      label: bot.label,
      instructions: bot.instructions,
      mascot: { shape: bot.mascot.shape, color: bot.mascot.color.toLowerCase() },
      skills: [...(bot.skills ?? [])],
    },
  };
}

const bad = (error: string): TemplateResult => ({ ok: false, error });

export function validateTemplate(raw: unknown): TemplateResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('isso não é um agente');
  const r = raw as Record<string, unknown>;
  if (r.kind !== TEMPLATE_KIND) return bad('esse arquivo não é um agente do Deck');
  if (r.v !== TEMPLATE_VERSION) return bad('versão do agente não suportada');
  const name = typeof r.name === 'string' ? sanitizeName(r.name) : '';
  if (!name) return bad('o agente não tem nome válido');
  if (typeof r.label !== 'string' && r.label !== undefined) return bad('cargo inválido');
  const label = (typeof r.label === 'string' ? r.label : '').replace(/\s+/g, ' ').trim();
  if (label.length > MAX_LABEL) return bad(`cargo passa de ${MAX_LABEL} caracteres`);
  if (typeof r.instructions !== 'string') return bad('o agente não tem instruções');
  if (new TextEncoder().encode(r.instructions).length > MAX_INSTRUCTIONS_BYTES) return bad('instruções passam de 8KB');
  const m = r.mascot as Record<string, unknown> | undefined;
  if (!m || typeof m.shape !== 'string' || !SHAPES.has(m.shape)) return bad('forma do mascote inválida');
  if (typeof m.color !== 'string' || !HEX_RE.test(m.color)) return bad('cor do mascote inválida');
  const skillsRaw = r.skills ?? [];
  if (!Array.isArray(skillsRaw) || skillsRaw.length > MAX_TEMPLATE_SKILLS || skillsRaw.some((s) => typeof s !== 'string' || !SKILL_ID_RE.test(s))) {
    return bad('lista de habilidades inválida');
  }
  const secret = findSecret(name, label, r.instructions);
  if (secret) return bad(`o agente traz ${secret} nas instruções — por segurança não importo`);
  return {
    ok: true,
    template: {
      kind: TEMPLATE_KIND,
      v: TEMPLATE_VERSION,
      name: name.slice(0, MAX_NAME),
      label,
      instructions: r.instructions,
      mascot: { shape: m.shape as MascotShape, color: m.color.toLowerCase() },
      skills: [...new Set(skillsRaw as string[])],
    },
  };
}

export function templateToJson(t: AgentTemplate): string {
  return JSON.stringify(t, null, 2);
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return null; }
}

export function templateToLink(t: AgentTemplate, origin: string): string {
  return `${origin}/equipe#${LINK_PARAM}=${toBase64Url(JSON.stringify(t))}`;
}

// Accepts what a person can paste: the JSON file's text, the share link, or the bare code after `#agente=`.
export function parseTemplate(input: string): TemplateResult {
  const text = input.trim();
  if (!text) return bad('cole o agente ou o link');
  if (text.length > MAX_TEMPLATE_BYTES * 2) return bad('arquivo grande demais para ser um agente');
  let json = text;
  if (!text.startsWith('{')) {
    const marker = `${LINK_PARAM}=`;
    const at = text.indexOf(marker);
    const code = at >= 0 ? text.slice(at + marker.length).split(/[&\s]/)[0] : text;
    const decoded = fromBase64Url(code);
    if (decoded === null) return bad('não consegui ler esse link');
    json = decoded;
  }
  if (new TextEncoder().encode(json).length > MAX_TEMPLATE_BYTES) return bad('arquivo grande demais para ser um agente');
  let obj: unknown;
  try { obj = JSON.parse(json); } catch { return bad('o conteúdo não é um agente válido'); }
  return validateTemplate(obj);
}

export interface ImportedDraft {
  name: string;
  label: string;
  instructions: string;
  skills: string[];
  shape: MascotShape;
  color: string;
  missingSkills: string[];
}

// Skills this box does not have are dropped and reported, never silently kept.
export function templateToDraft(t: AgentTemplate, known: ReadonlySet<string>): ImportedDraft {
  const skills = knownSkillFilter(t.skills, known);
  return {
    name: t.name,
    label: t.label,
    instructions: t.instructions,
    skills,
    shape: t.mascot.shape,
    color: t.mascot.color,
    missingSkills: t.skills.filter((s) => !skills.includes(s)),
  };
}
