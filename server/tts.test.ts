import { describe, it, expect, vi } from 'vitest';
import {
  TTS_MAX_CHARS, TtsError, edgeVoice, escapeXml, parseTtsText, synthesizeElevenLabs,
} from './tts';

describe('parseTtsText', () => {
  it('returns trimmed text', () => {
    expect(parseTtsText('  oi  ')).toBe('oi');
  });

  it('rejects empty, whitespace and non-string input with 400', () => {
    for (const raw of ['', '   ', undefined, 3, null]) {
      const err = (() => { try { parseTtsText(raw); } catch (e) { return e as TtsError; } })();
      expect(err).toBeInstanceOf(TtsError);
      expect(err!.status).toBe(400);
    }
  });

  it('rejects text over the cap', () => {
    expect(() => parseTtsText('a'.repeat(TTS_MAX_CHARS + 1))).toThrowError(/too long/);
    expect(parseTtsText('a'.repeat(TTS_MAX_CHARS))).toHaveLength(TTS_MAX_CHARS);
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
