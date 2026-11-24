import type { Block, Message } from '../../data/types';
import type { BitState } from './bit-state';

export type TurnPhase = 'idle' | 'thinking' | 'streaming';
export type LinkState = 'open' | 'connecting' | 'closed';

export interface TurnBitSignals {
  conn?: LinkState;
  phase: TurnPhase;
  // Blocks of the assistant bubble the turn is writing into (empty before the first frame).
  blocks?: Block[];
  waiting?: boolean;
  failed?: boolean;
  quotaPaused?: boolean;
  justDone?: boolean;
}

export const DONE_HOLD_MS = 2000;

// The phase alone can't tell tool work from writing: the client flips to
// 'streaming' on text deltas, thinking deltas and tool frames alike, so the
// tail of the live bubble decides.
function liveTurnState(phase: TurnPhase, blocks: Block[]): BitState {
  if (blocks.some((b) => b.type === 'tool' && b.tool.status === 'running')) return 'working';
  if (phase === 'thinking') return 'thinking';
  const last = blocks[blocks.length - 1];
  if (last && (last.type === 'text' || last.type === 'code')) return 'talking';
  return 'thinking';
}

// Priority: a dead link makes everything else stale; an open question or a
// pending approval blocks the turn on the user even while the CLI is being
// killed; a failure outranks the idle afterglow.
export function turnBitState(s: TurnBitSignals): BitState {
  if (s.conn === 'closed') return 'sleeping';
  if (s.waiting) return 'waiting';
  if (s.failed) return 'error';
  if (s.phase !== 'idle') return liveTurnState(s.phase, s.blocks ?? []);
  if (s.quotaPaused) return 'error';
  if (s.conn === 'connecting') return 'connecting';
  if (s.justDone) return 'happy';
  return 'idle';
}

// The bubble a running turn writes into: the last message, when it is the
// assistant's and comes after the latest prompt.
export function liveTurnBlocks(messages: Message[]): Block[] {
  const last = messages[messages.length - 1];
  return last && last.role === 'assistant' ? last.blocks : [];
}
