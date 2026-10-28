import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

vi.mock('./config', () => ({ CONFIG: { authToken: 'secret' } }));

import {
  TTS_MAX_CHARS, TtsError, edgeVoice, escapeXml, handleTtsRequest, isTtsPath, parseTtsText, synthesizeElevenLabs,
} from './tts';

function fakeRes() {
  const res = { status: 0, body: '' as string | Buffer, headersSent: false } as {
    status: number; body: string | Buffer; headersSent: boolean;
    writeHead: (s: number, h: Record<string, unknown>) => void; end: (b?: string | Buffer) => void;
  };
  res.writeHead = (s) => { res.status = s; res.headersSent = true; };
  res.end = (b) => { if (b !== undefined) res.body = b; };
  return res;
}

function fakeReq(method: string, auth: string | undefined, body: string) {
  const req = new EventEmitter() as EventEmitter & { method: string; headers: Record<string, string | undefined>; destroy: () => void };
  req.method = method;
  req.headers = { authorization: auth };
  req.destroy = () => {};
  queueMicrotask(() => { req.emit('data', Buffer.from(body)); req.emit('end'); });
  return req as unknown as IncomingMessage;
}

describe('parseTtsText', () => {
  it('returns trimmed text', () => {
    expect(parseTtsText('{"text":"  oi  "}')).toBe('oi');
  });

  it('rejects empty, missing, non-string and invalid json with 400', () => {
    for (const raw of ['{"text":""}', '{"text":"   "}', '{}', '{"text":3}', 'nope']) {
      const err = (() => { try { parseTtsText(raw); } catch (e) { return e as TtsError; } })();
      expect(err).toBeInstanceOf(TtsError);
      expect(err!.status).toBe(400);
    }
  });

  it('rejects text over the cap', () => {
    expect(() => parseTtsText(JSON.stringify({ text: 'a'.repeat(TTS_MAX_CHARS + 1) }))).toThrowError(/too long/);
    expect(parseTtsText(JSON.stringify({ text: 'a'.repeat(TTS_MAX_CHARS) }))).toHaveLength(TTS_MAX_CHARS);
  });
});

describe('escapeXml', () => {
  it('escapes markup so user text cannot inject SSML', () => {
    expect(escapeXml(`a & b <c> "d" 'e'`)).toBe('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;');
  });
});

describe('edgeVoice', () => {
  it('defaults to pt-BR-AntonioNeural and honours the override', () => {
    expect(edgeVoice({})).toBe('pt-BR-AntonioNeural');
    expect(edgeVoice({ COCKPIT_TTS_VOICE: 'pt-BR-FranciscaNeural' })).toBe('pt-BR-FranciscaNeural');
    expect(edgeVoice({ COCKPIT_TTS_VOICE: '  ' })).toBe('pt-BR-AntonioNeural');
  });
});

describe('isTtsPath', () => {
  it('matches the path ignoring the query string only', () => {
    expect(isTtsPath('/api/tts')).toBe(true);
    expect(isTtsPath('/api/tts?x=1')).toBe(true);
    expect(isTtsPath('/api/tts/more')).toBe(false);
    expect(isTtsPath(undefined)).toBe(false);
  });
});

describe('synthesizeElevenLabs', () => {
  it('posts to the voice endpoint with the key in a header only', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const out = await synthesizeElevenLabs('olá', 'k-123', 'voice1', fetchImpl as unknown as typeof fetch);
    expect(out.length).toBe(3);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice1?output_format=mp3_44100_128');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('k-123');
    expect(String(init.body)).toContain('eleven_flash_v2_5');
    expect(url).not.toContain('k-123');
  });

  it('maps an upstream failure to 502 without leaking the key', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 401 }));
    const err = (await synthesizeElevenLabs('x', 'k-123', 'v', fetchImpl as unknown as typeof fetch).catch((e) => e)) as TtsError;
    expect(err.status).toBe(502);
    expect(err.message).not.toContain('k-123');
  });
});

describe('handleTtsRequest', () => {
  it('401s without or with a wrong bearer token', async () => {
    for (const auth of [undefined, 'Bearer wrong']) {
      const res = fakeRes();
      await handleTtsRequest(fakeReq('POST', auth, '{"text":"oi"}'), res as unknown as ServerResponse);
      expect(res.status).toBe(401);
    }
  });

  it('405s a non-POST and 400s empty text when authorized', async () => {
    const get = fakeRes();
    await handleTtsRequest(fakeReq('GET', 'Bearer secret', ''), get as unknown as ServerResponse);
    expect(get.status).toBe(405);
    const empty = fakeRes();
    await handleTtsRequest(fakeReq('POST', 'Bearer secret', '{"text":" "}'), empty as unknown as ServerResponse);
    expect(empty.status).toBe(400);
  });
});
