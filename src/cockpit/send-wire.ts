import type { ClientMsg, Effort, PermMode } from '../../shared/protocol';

type SendFrame = Extract<ClientMsg, { t: 'send' }>;
type ForkFrame = Extract<ClientMsg, { t: 'canvas-card-fork' }>;

// Pure wire-builder shared by onSend (the main composer) and onSendTo (the
// canvas prompt bar) in useCockpit.ts — the ONLY place bypass/skills/mcps/
// effort/mode/model resolution happens for a 'send' frame, so a prompt sent
// from the canvas can never drift from what the composer would have sent for
// the same text (canvas review #593 items 2/3).
export interface SendWireCtx {
  canBypass: boolean;
  bypassOn: boolean;
  selectedSkills: string[];
  selectedMcps: string[];
  mode: PermMode;
  effort: Effort;
}

export function buildSendWire(
  ctx: SendWireCtx,
  sessionKey: string,
  resumeId: string | undefined,
  text: string,
  msgId: string,
  model: string,
  modeOverride?: PermMode,
  auto?: boolean,
  allowWorkflow?: boolean,
): SendFrame {
  // bypass só vai no fio quando o servidor anunciou a capacidade (admin + env +
  // loopback). O backend reimpõe via bypassAllowed — isto é só pra não anunciar
  // um pedido que seria recusado.
  const bypassWire = ctx.canBypass && ctx.bypassOn ? true : undefined;
  // skills/mcps só vão no fio quando o usuário restringiu (subconjunto); vazio = todos.
  const skillsWire = ctx.selectedSkills.length ? ctx.selectedSkills : undefined;
  const mcpsWire = ctx.selectedMcps.length ? ctx.selectedMcps : undefined;
  return {
    t: 'send', sessionKey, sessionId: resumeId, text, msgId,
    mode: modeOverride ?? ctx.mode, model, effort: ctx.effort,
    bypass: bypassWire, skills: skillsWire, mcps: mcpsWire,
    auto: auto || undefined, allowWorkflow: allowWorkflow || undefined,
  };
}

// Same ctx-resolution rule as buildSendWire, for the card-reuse "fork"
// path (session-reuse.ts): a card forked into a parallel session must run
// under the exact same bypass/skills/mcps/effort/mode the composer would
// have used, never a source turn's own params (server/canvas/flows.ts
// safeParams draws that same line for flow-delivered forks).
export function buildForkWire(ctx: SendWireCtx, parentSessionId: string, cardId: string, text: string, model: string): ForkFrame {
  const bypassWire = ctx.canBypass && ctx.bypassOn ? true : undefined;
  const skillsWire = ctx.selectedSkills.length ? ctx.selectedSkills : undefined;
  const mcpsWire = ctx.selectedMcps.length ? ctx.selectedMcps : undefined;
  return {
    t: 'canvas-card-fork', parentSessionId, cardId, text,
    mode: ctx.mode, model, effort: ctx.effort, bypass: bypassWire, skills: skillsWire, mcps: mcpsWire,
  };
}
