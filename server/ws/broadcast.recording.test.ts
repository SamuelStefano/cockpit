import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import type { WebSocket, WebSocketServer } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import { broadcast, setClientSource, setRecordingDrop, setSocketRecording } from './broadcast';

const sock = () => Object.assign(new EventEmitter(), { readyState: 1, OPEN: 1, bufferedAmount: 0, sent: [] as string[], send(p: string) { this.sent.push(p); } }) as unknown as WebSocket & { sent: string[] };

describe('broadcast recording filter', () => {
  it('skips a frame only for sockets in recording mode', () => {
    const a = sock(); const b = sock();
    setClientSource({ clients: new Set([a, b]) } as unknown as WebSocketServer);
    setRecordingDrop((m: ServerMsg) => m.t === 'delta');
    setSocketRecording(a, true);
    broadcast({ t: 'delta', sessionKey: 'k', text: 'secret' });
    broadcast({ t: 'done', sessionKey: 'k', sessionId: 's' });
    expect(a.sent.map((p) => JSON.parse(p).t)).toEqual(['done']);
    expect(b.sent.map((p) => JSON.parse(p).t)).toEqual(['delta', 'done']);
    setSocketRecording(a, false);
    broadcast({ t: 'delta', sessionKey: 'k', text: 'x' });
    expect(a.sent).toHaveLength(2);
    setRecordingDrop(null); setClientSource(null);
  });
});
