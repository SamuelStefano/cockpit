import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { isBlockedAddress, parseEndpoint, probe } from './providers';

describe('isBlockedAddress', () => {
  it('blocks link-local, metadata, unspecified and multicast', () => {
    for (const ip of ['169.254.169.254', '169.254.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '100.100.100.200', 'fe80::1', 'fd00:ec2::254', '::', 'ff02::1', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', 'not-an-ip']) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });
  it('keeps loopback and private ranges for local model servers', () => {
    for (const ip of ['127.0.0.1', '::1', '10.0.0.5', '192.168.1.9', '172.16.0.2', '100.64.0.7', '8.8.8.8']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
});

describe('parseEndpoint', () => {
  it('accepts only http and https', () => {
    expect(parseEndpoint('https://ia.example.com/v1').ok).toBe(true);
    expect(parseEndpoint('http://127.0.0.1:11434/v1').ok).toBe(true);
    for (const bad of ['file:///etc/passwd', 'ftp://x/v1', 'gopher://x', 'javascript:alert(1)', '', 'nope', 42]) {
      expect(parseEndpoint(bad).ok, String(bad)).toBe(false);
    }
  });
  it('refuses metadata addresses and names, and credentials in the URL', () => {
    for (const bad of ['http://169.254.169.254/latest', 'http://[fe80::1]/v1', 'http://metadata.google.internal/v1', 'http://0.0.0.0/v1', 'https://user:pw@host/v1']) {
      expect(parseEndpoint(bad).ok, bad).toBe(false);
    }
  });
  it('drops query and fragment', () => {
    const r = parseEndpoint('https://h.example.com/v1?api_key=SECRET#x');
    expect(r.ok && r.url.search + r.url.hash).toBe('');
  });
});

describe('probe', () => {
  let srv: Server | undefined;
  afterEach(() => new Promise<void>((r) => { if (srv) srv.close(() => r()); else r(); srv = undefined; }));

  function serve(handler: Parameters<typeof createServer>[1]): Promise<string> {
    return new Promise((resolve) => {
      srv = createServer(handler).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(srv!.address() as AddressInfo).port}/v1`));
    });
  }

  it('lists models, classifies them and sends the key as a bearer header only', async () => {
    let auth = '';
    let url = '';
    const base = await serve((req, res) => {
      auth = req.headers.authorization ?? '';
      url = req.url ?? '';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'qwen3.5-72b' }, { id: 'whisper-large' }] }));
    });
    const r = await probe(base, 'sk-secret-123');
    expect(auth).toBe('Bearer sk-secret-123');
    expect(url).toBe('/v1/models');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.models.map((m) => [m.id, m.usable])).toEqual([['qwen3.5-72b', true], ['whisper-large', false]]);
      expect(r.models[1].reason).toMatch(/áudio/);
    }
    expect(JSON.stringify(r)).not.toContain('sk-secret-123');
  });

  it('never echoes the key in an error', async () => {
    const base = await serve((_req, res) => { res.statusCode = 401; res.end('bad key sk-secret-123'); });
    const r = await probe(base, 'sk-secret-123');
    expect(r).toEqual({ ok: false, error: 'O servidor recusou a chave.' });
  });

  it('does not follow redirects', async () => {
    let hits = 0;
    const base = await serve((req, res) => {
      hits += 1;
      res.statusCode = 302;
      res.setHeader('location', 'http://169.254.169.254/latest');
      res.end();
    });
    const r = await probe(base);
    expect(r.ok).toBe(false);
    expect(hits).toBe(1);
  });

  it('rejects an answer that is not a model list', async () => {
    const base = await serve((_req, res) => { res.end('<html>hi</html>'); });
    expect((await probe(base)).ok).toBe(false);
  });

  it('rejects blocked and malformed input before any request', async () => {
    expect((await probe('http://169.254.169.254/v1')).ok).toBe(false);
    expect((await probe('file:///etc/passwd')).ok).toBe(false);
    expect((await probe('https://h.example.com/v1', 'bad key with spaces')).ok).toBe(false);
  });

  it('times out on a server that never answers', async () => {
    const base = await serve(() => {});
    const t0 = Date.now();
    const r = await probe(base);
    expect(r).toEqual({ ok: false, error: 'O servidor demorou demais para responder.' });
    expect(Date.now() - t0).toBeLessThan(9000);
  }, 12000);
});
