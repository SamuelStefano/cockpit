// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { requestAccountDeletion, emailConfirms } from './accountDeletion';

const reply = (status: number) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status }) as Response) as unknown as typeof fetch;

describe('requestAccountDeletion', () => {
  it('POSTs to the relay with the bearer token only in the header', async () => {
    const f = reply(200);
    expect(await requestAccountDeletion('tok', f)).toEqual({ ok: true });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/account\/delete$/);
    expect(url).not.toContain('tok');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it.each([401, 403, 429, 500, 502])('turns %i into a message', async (status) => {
    const r = await requestAccountDeletion('t', reply(status));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message.length).toBeGreaterThan(10);
  });

  it('turns a network failure into a message', async () => {
    const f = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect((await requestAccountDeletion('t', f)).ok).toBe(false);
  });
});

describe('emailConfirms', () => {
  it('ignores case and surrounding space, refuses anything else', () => {
    expect(emailConfirms('  Ana@X.com ', 'ana@x.com')).toBe(true);
    expect(emailConfirms('ana@x.co', 'ana@x.com')).toBe(false);
    expect(emailConfirms('', '')).toBe(false);
  });
});
