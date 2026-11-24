export type CallPhase = 'off' | 'listening' | 'thinking' | 'speaking';

export interface CallState {
  phase: CallPhase;
  muted: boolean;
}

export type CallEvent =
  | { type: 'dial' }
  | { type: 'hangup' }
  | { type: 'toggle-mute' }
  | { type: 'utterance-sent' }
  | { type: 'reply-ready' }
  | { type: 'speech-done' }
  | { type: 'barge-in' }
  | { type: 'no-reply' };

export const initialCallState: CallState = { phase: 'off', muted: false };

export function callReducer(state: CallState, event: CallEvent): CallState {
  if (event.type === 'dial') return state.phase === 'off' ? { phase: 'listening', muted: false } : state;
  if (state.phase === 'off') return state;
  switch (event.type) {
    case 'hangup':
      return initialCallState;
    case 'toggle-mute':
      return { ...state, muted: !state.muted };
    case 'utterance-sent':
      return { ...state, phase: 'thinking' };
    case 'reply-ready':
      return state.phase === 'thinking' ? { ...state, phase: 'speaking' } : state;
    case 'speech-done':
      return state.phase === 'speaking' ? { ...state, phase: 'listening' } : state;
    case 'barge-in':
      return state.phase === 'speaking' ? { ...state, phase: 'listening' } : state;
    case 'no-reply':
      return state.phase === 'thinking' ? { ...state, phase: 'listening' } : state;
    default:
      return state;
  }
}

export function recognizerShouldRun(state: CallState): boolean {
  return state.phase !== 'off' && !state.muted;
}

export const CALL_LABEL: Record<Exclude<CallPhase, 'off'>, string> = {
  listening: 'Ouvindo',
  thinking: 'Pensando',
  speaking: 'Falando',
};
