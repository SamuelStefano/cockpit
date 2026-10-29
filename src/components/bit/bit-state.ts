export type BitState = 'idle' | 'wave' | 'thinking' | 'working' | 'talking' | 'waiting' | 'happy' | 'sleeping' | 'error' | 'connecting';

export const BIT_STATES: BitState[] = ['idle', 'wave', 'thinking', 'working', 'talking', 'waiting', 'happy', 'sleeping', 'error', 'connecting'];

export const BIT_STATE_LABEL: Record<BitState, string> = {
  idle: 'Bit, à disposição',
  wave: 'Bit dando oi',
  thinking: 'Bit pensando',
  working: 'Bit trabalhando',
  talking: 'Bit escrevendo a resposta',
  waiting: 'Bit esperando você',
  happy: 'Bit comemorando',
  sleeping: 'Bit dormindo',
  error: 'Bit preocupado',
  connecting: 'Bit conectando',
};

export interface BitSignals {
  conn?: 'open' | 'connecting' | 'closed' | string;
  agentOnline?: boolean;
  running?: boolean;
  thinking?: boolean;
  error?: boolean;
  justDone?: boolean;
  // Running, waiting and queued work all just reached zero (see useAllClear).
  allClear?: boolean;
}

// One reading of the app's state for the header Bit, in priority order: a dead
// link wins over everything (nothing else on screen is current), then a failure
// the user should look at, then live work.
export function bitStateFor(s: BitSignals): BitState {
  if (s.conn === 'closed') return 'sleeping';
  if (s.conn === 'connecting' || s.agentOnline === false) return 'connecting';
  if (s.error) return 'error';
  if (s.running) return s.thinking ? 'thinking' : 'working';
  return s.justDone || s.allClear ? 'happy' : 'idle';
}
