import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let managed: Record<string, string> = {};
vi.mock('./admin-ops', () => ({ managedEnvSync: () => managed }));

// DECK_S3_UPLOAD_URL é lido no import: fixamos antes pra nenhum caso apontar pra
// edge fn real da DFL.
process.env.DECK_S3_UPLOAD_URL = 'https://fake.local/functions/v1/upload-file';
const { s3Enabled, uploadToS3 } = await import('./s3');

const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];
let reply: () => Response | Promise<Response>;

beforeEach(() => {
  managed = {};
  delete process.env.DECK_S3_ANON_KEY;
  calls = [];
  reply = () => new Response(JSON.stringify({ url: 'https://s3/x.png', path: 'p/x.png', name: 'x.png', type: 'image/png' }), { status: 200 });
  globalThis.fetch = ((url: string, init: RequestInit) => { calls.push({ url, init }); return Promise.resolve(reply()); }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

const buf = new Uint8Array([1, 2, 3]);

describe('s3Enabled', () => {
  it('desligado sem anon key', () => {
    expect(s3Enabled()).toBe(false);
  });

  it('a key pode vir do env do processo ou do env gerenciado (repo é público)', () => {
    managed = { DECK_S3_ANON_KEY: 'k-gerenciada' };
    expect(s3Enabled()).toBe(true);
    managed = {};
    process.env.DECK_S3_ANON_KEY = 'k-processo';
    expect(s3Enabled()).toBe(true);
  });
});

describe('uploadToS3', () => {
  it('não chama a rede quando o S3 está desligado', async () => {
    expect(await uploadToS3(buf, 'x.png', 'image/png')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('sobe multipart autenticado e devolve a URL pública', async () => {
    managed = { DECK_S3_ANON_KEY: 'k' };
    const r = await uploadToS3(buf, 'x.png', 'image/png');
    expect(r).toEqual({ url: 'https://s3/x.png', path: 'p/x.png', name: 'x.png', type: 'image/png' });
    const [{ url, init }] = calls;
    expect(url).toBe('https://fake.local/functions/v1/upload-file');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer k');
    expect(headers.apikey).toBe('k');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('completa os campos que a edge fn omitir com o que o chamador passou', async () => {
    managed = { DECK_S3_ANON_KEY: 'k' };
    reply = () => new Response(JSON.stringify({ url: 'https://s3/y' }), { status: 200 });
    expect(await uploadToS3(buf, 'y.pdf', 'application/pdf')).toEqual({
      url: 'https://s3/y', path: '', name: 'y.pdf', type: 'application/pdf',
    });
  });
});

// Espelho best-effort: NADA aqui pode derrubar (nem segurar) o anexo, que já foi
// gravado localmente quando este upload roda.
describe('uploadToS3: falha nunca derruba o anexo', () => {
  beforeEach(() => { managed = { DECK_S3_ANON_KEY: 'k' }; });

  it('resposta não-ok vira null', async () => {
    reply = () => new Response('nope', { status: 500 });
    expect(await uploadToS3(buf, 'x.png', 'image/png')).toBeNull();
  });

  it('corpo sem url vira null', async () => {
    reply = () => new Response(JSON.stringify({ path: 'p/x.png' }), { status: 200 });
    expect(await uploadToS3(buf, 'x.png', 'image/png')).toBeNull();
  });

  it('corpo que não é JSON vira null', async () => {
    reply = () => new Response('<html>cloudflare</html>', { status: 200 });
    expect(await uploadToS3(buf, 'x.png', 'image/png')).toBeNull();
  });

  it('rede caída vira null', async () => {
    reply = () => Promise.reject(new Error('ECONNREFUSED'));
    expect(await uploadToS3(buf, 'x.png', 'image/png')).toBeNull();
  });

  // O fetch do Node não tem timeout default e o cliente só recebe o anexo depois
  // deste await: sem o signal, uma edge fn pendurada travava o anexo pra sempre.
  it('manda um AbortSignal com prazo', async () => {
    await uploadToS3(buf, 'x.png', 'image/png');
    const signal = calls[0].init.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('aborto por timeout vira null', async () => {
    reply = () => Promise.reject(Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }));
    expect(await uploadToS3(buf, 'x.png', 'image/png')).toBeNull();
  });
});
