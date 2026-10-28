import type { ClientMsg, ServerMsg } from '../../shared/protocol';

// Request/response over the chat socket (direct or relay-sealed): the box renders
// the mp3, so the call voice works wherever the chat does. Frames carry a reqId and
// we ignore ids we did not issue.
type Send = (m: ClientMsg) => boolean;

const TTS_TIMEOUT_MS = 20000;
const pending = new Map<string, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();
let sender: Send | null = null;
let seq = 0;

export function setTtsSender(send: Send | null) {
  sender = send;
}

export function handleTtsMsg(msg: ServerMsg): boolean {
  if (msg.t !== 'tts-audio' && msg.t !== 'tts-error') return false;
  const p = pending.get(msg.reqId);
  if (!p) return true;
  pending.delete(msg.reqId);
  if (msg.t === 'tts-error') { p.reject(new Error('tts failed')); return true; }
  try {
    const bin = atob(msg.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length === 0) throw new Error('empty audio');
    p.resolve(new Blob([bytes], { type: 'audio/mpeg' }));
  } catch (e) {
    p.reject(e as Error);
  }
  return true;
}

export function requestTts(text: string, signal: AbortSignal): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    if (signal.aborted) { reject(new Error('aborted')); return; }
    const reqId = `tts${Date.now().toString(36)}${(seq++).toString(36)}`;
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); };
    const timer = setTimeout(() => { pending.delete(reqId); done(); reject(new Error('tts timeout')); }, TTS_TIMEOUT_MS);
    const onAbort = () => { pending.delete(reqId); done(); reject(new Error('aborted')); };
    signal.addEventListener('abort', onAbort);
    pending.set(reqId, {
      resolve: (b) => { done(); resolve(b); },
      reject: (e) => { done(); reject(e); },
    });
    if (!sender || !sender({ t: 'tts', reqId, text })) {
      pending.delete(reqId);
      done();
      reject(new Error('socket not open'));
    }
  });
}
