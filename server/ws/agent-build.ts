import type { ClientMsg } from '../../shared/protocol';
import type { BuilderDraft, BuilderTurn } from '../../shared/agent-builder';

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 8000;
const MAX_REQ_ID = 64;
const MAX_DRAFT_SKILLS = 40;

export interface BuildRequest {
  reqId: string;
  history: BuilderTurn[];
  draft: BuilderDraft;
}

type BuildFrame = Extract<ClientMsg, { t: 'agent-build' }>;

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);

// Edge validation of the frame: the system prompt is always built server-side, so
// a client can only supply the conversation and the draft it wants to refine.
export function cleanBuildRequest(msg: BuildFrame): BuildRequest | null {
  const reqId = text(msg.reqId, MAX_REQ_ID);
  if (!reqId || !Array.isArray(msg.history) || msg.history.length === 0 || msg.history.length > MAX_TURNS) return null;
  const history: BuilderTurn[] = [];
  for (const t of msg.history) {
    const body = text(t?.text, MAX_TURN_CHARS);
    if (body === null || (t.role !== 'user' && t.role !== 'assistant')) return null;
    history.push({ role: t.role, text: body });
  }
  if (history[history.length - 1].role !== 'user') return null;
  const d = msg.draft;
  const name = text(d?.name, 200);
  const label = text(d?.label, 400);
  const instructions = text(d?.instructions, 16_000);
  if (name === null || label === null || instructions === null) return null;
  if (!Array.isArray(d.skills) || d.skills.length > MAX_DRAFT_SKILLS || d.skills.some((s) => typeof s !== 'string' || s.length > 80)) return null;
  return { reqId, history, draft: { name, label, instructions, skills: d.skills } };
}
