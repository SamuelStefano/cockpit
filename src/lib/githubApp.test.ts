import { describe, expect, it, vi } from 'vitest';
import { githubInstallUrl, githubStatus, linkInstallation, unlinkInstallation } from './githubApp';

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe('githubApp service', () => {
  it('builds the install url', () => {
    expect(githubInstallUrl('my-app')).toBe('https://github.com/apps/my-app/installations/new');
  });
  it('links with installation id and code', async () => {
    const call = vi.fn().mockResolvedValue(ok({ ok: true, account_login: 'octo' }));
    expect(await linkInstallation(7, 'c', call)).toBe('octo');
    expect(call).toHaveBeenCalledWith('/link', { method: 'POST', body: { installation_id: 7, code: 'c' } });
  });
  it('lists installations', async () => {
    const call = vi.fn().mockResolvedValue(ok({ installations: [{ installation_id: 1, account_login: 'a' }] }));
    expect(await githubStatus(call)).toEqual([{ installation_id: 1, account_login: 'a' }]);
  });
  it('unlinks and throws on http error', async () => {
    const call = vi.fn().mockResolvedValueOnce(ok({ ok: true })).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await unlinkInstallation(1, call);
    await expect(unlinkInstallation(1, call)).rejects.toThrow('500');
  });
});
