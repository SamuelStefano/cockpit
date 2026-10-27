import type { SkillMeta } from './protocol';
import { MAX_INSTRUCTIONS_BYTES, MAX_LABEL, MAX_NAME } from './team';

export interface BuilderDraft {
  name: string;
  label: string;
  instructions: string;
  skills: string[];
}

export interface BuilderPatch {
  name?: string;
  label?: string;
  instructions?: string;
  skills?: string[];
}

export interface BuilderTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface BuilderReply {
  message: string;
  patch: BuilderPatch | null;
}

export const EMPTY_BUILDER_DRAFT: BuilderDraft = { name: '', label: '', instructions: '', skills: [] };

export const BUILDER_FENCE = 'agente';
const FENCE_RE = new RegExp('```' + BUILDER_FENCE + '[ \\t]*\\r?\\n([\\s\\S]*?)```', 'g');
const MAX_HISTORY_TURNS = 24;
const MAX_TURN_CHARS = 4000;
const MAX_BLURB = 90;
const MAX_SKILLS = 40;
const SKILL_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

// The model sees ids so it can name them in the block; the person only ever sees the blurb.
export function skillBlurb(s: Pick<SkillMeta, 'id' | 'name' | 'description'>): string {
  const flat = s.description.replace(/\s+/g, ' ').trim();
  if (!flat) return s.name;
  const first = flat.split(/(?<=[.!?])\s/)[0] ?? flat;
  return first.length > MAX_BLURB ? `${first.slice(0, MAX_BLURB - 1).trimEnd()}…` : first;
}

export function builderSystemPrompt(skills: SkillMeta[], draft: BuilderDraft): string {
  const abilities = skills.length
    ? skills.map((s) => `- ${s.id}: ${skillBlurb(s)}`).join('\n')
    : '(nenhuma habilidade extra disponível)';
  const current = JSON.stringify(draft);
  return [
    'Você ajuda uma pessoa leiga a criar ou ajustar um assistente (um "agente") conversando em português do Brasil.',
    'Faça UMA pergunta curta por vez, em linguagem simples: o que o agente deve fazer, como deve falar (tom) e o que ele pode mexer.',
    'Nunca use as palavras "skill", "prompt", "JSON" ou "system" com a pessoa. Fale em "habilidades" e "instruções".',
    'Em toda resposta, depois do texto para a pessoa, envie o estado atualizado do agente num bloco assim (só os campos que mudaram):',
    '```' + BUILDER_FENCE,
    '{"name":"nome-curto","label":"cargo em poucas palavras","instructions":"instruções completas, em segunda pessoa, o que fazer, tom e limites","skills":["id-da-habilidade"]}',
    '```',
    `Regras do bloco: name sem espaços (letras, números, - _ .), até ${MAX_NAME} caracteres; label até ${MAX_LABEL}; instructions até ${Math.floor(MAX_INSTRUCTIONS_BYTES / 1024)}KB; skills = só ids da lista abaixo, a lista COMPLETA das habilidades ligadas.`,
    'Nunca coloque senha, chave, token ou dado secreto nas instruções. Se a pessoa colar um, avise e não repita.',
    'Quando a pessoa disser que está bom, confirme que ela pode aceitar a prévia. Não invente habilidades que não estão na lista.',
    '',
    'Habilidades disponíveis (id: o que faz):',
    abilities,
    '',
    'Agente atual (vazio = criando do zero):',
    current,
  ].join('\n');
}

export function builderPrompt(history: BuilderTurn[]): string {
  const recent = history.slice(-MAX_HISTORY_TURNS);
  const lines = recent.map((t) => `${t.role === 'user' ? 'Pessoa' : 'Você'}: ${t.text.slice(0, MAX_TURN_CHARS)}`);
  return `${lines.join('\n\n')}\n\nResponda como "Você", seguindo as regras.`;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function parsePatch(raw: string): BuilderPatch | null {
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const patch: BuilderPatch = {};
  const name = asString(o.name);
  const label = asString(o.label);
  const instructions = asString(o.instructions);
  if (name !== undefined) patch.name = name;
  if (label !== undefined) patch.label = label;
  if (instructions !== undefined) patch.instructions = instructions;
  if (Array.isArray(o.skills)) patch.skills = o.skills.filter((s): s is string => typeof s === 'string');
  return Object.keys(patch).length ? patch : null;
}

// The last well-formed block wins; every block is stripped from the text the person reads.
export function parseBuilderReply(text: string): BuilderReply {
  let patch: BuilderPatch | null = null;
  for (const m of text.matchAll(FENCE_RE)) patch = parsePatch(m[1]) ?? patch;
  const message = text.replace(FENCE_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  return { message, patch };
}

export function sanitizeName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_.-]/gu, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .slice(0, MAX_NAME);
}

function clampBytes(s: string, max: number): string {
  const enc = new TextEncoder();
  if (enc.encode(s).length <= max) return s;
  let out = s;
  while (out && enc.encode(out).length > max) out = out.slice(0, Math.floor(out.length * 0.9));
  return out.trimEnd();
}

export function knownSkillFilter(ids: string[], known: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  for (const id of ids) if (SKILL_ID_RE.test(id) && known.has(id)) seen.add(id);
  return [...seen].slice(0, MAX_SKILLS);
}

// Field by field: a patch that is wrong in one field still lands the others.
export function mergeDraft(draft: BuilderDraft, patch: BuilderPatch | null, known: ReadonlySet<string>): BuilderDraft {
  if (!patch) return draft;
  const next = { ...draft };
  if (patch.name !== undefined) {
    const name = sanitizeName(patch.name);
    if (name) next.name = name;
  }
  if (patch.label !== undefined) next.label = patch.label.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);
  if (patch.instructions !== undefined) next.instructions = clampBytes(patch.instructions.trim(), MAX_INSTRUCTIONS_BYTES);
  if (patch.skills !== undefined) next.skills = knownSkillFilter(patch.skills, known);
  return next;
}

export function draftIsEmpty(d: BuilderDraft): boolean {
  return !d.name && !d.label && !d.instructions.trim() && d.skills.length === 0;
}

export function draftsEqual(a: BuilderDraft, b: BuilderDraft): boolean {
  return a.name === b.name && a.label === b.label && a.instructions === b.instructions
    && a.skills.length === b.skills.length && a.skills.every((s, i) => s === b.skills[i]);
}

export function toggleSkill(skills: string[], id: string): string[] {
  return skills.includes(id) ? skills.filter((s) => s !== id) : [...skills, id];
}

export interface AppliedReply {
  message: string;
  draft: BuilderDraft;
  changed: boolean;
}

export function applyBuilderReply(draft: BuilderDraft, text: string, known: ReadonlySet<string>): AppliedReply {
  const { message, patch } = parseBuilderReply(text);
  const next = mergeDraft(draft, patch, known);
  return { message: message || 'Atualizei a prévia.', draft: next, changed: !draftsEqual(draft, next) };
}
