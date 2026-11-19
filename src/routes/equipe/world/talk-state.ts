import type { TalkChunkPayload, TalkPayload } from '../../../../shared/team-talk';

export interface TalkState {
  botId: string | null;
  snapshot: TalkPayload | null;
  reply: string;
  msgId: string | null;
  sending: boolean;
  notice: string | null;
}

export type TalkAction =
  | { t: 'open'; botId: string }
  | { t: 'close' }
  | { t: 'snapshot'; talk: TalkPayload }
  | { t: 'sent'; msgId: string }
  | { t: 'chunk'; botId: string; msgId?: string; chunk: TalkChunkPayload };

export const initialTalk: TalkState = { botId: null, snapshot: null, reply: '', msgId: null, sending: false, notice: null };

const REFUSED: Record<string, string> = {
  'no-session': 'Este bot ainda não tem sessão.',
  empty: 'Escreva uma mensagem.',
  'too-long': 'Mensagem longa demais.',
  paused: 'A vila está pausada.',
  busy: 'Aguarde, o bot ainda está respondendo.',
};

export function talkReducer(s: TalkState, a: TalkAction): TalkState {
  switch (a.t) {
    case 'open': return s.botId === a.botId ? s : { ...initialTalk, botId: a.botId };
    case 'close': return initialTalk;
    case 'snapshot': return s.botId === a.talk.botId ? { ...s, snapshot: a.talk } : s;
    case 'sent': return s.sending ? s : { ...s, msgId: a.msgId, reply: '', sending: true, notice: null };
    case 'chunk': {
      if (s.botId !== a.botId) return s;
      const c = a.chunk;
      if (c.kind === 'refused') return a.msgId && a.msgId !== s.msgId ? s : { ...s, sending: (c.reason as string) === 'busy' ? s.sending : false, notice: REFUSED[c.reason] ?? 'Recusado.' };
      if (c.kind === 'delta') return 'redacted' in c ? s : s.sending ? { ...s, reply: s.reply + c.text } : s;
      if (c.kind === 'done') return { ...s, sending: false };
      return { ...s, sending: false, notice: 'redacted' in c ? 'Erro no bot.' : c.message };
    }
  }
}
