import { describe, it, expect, afterEach, vi } from 'vitest';

async function load(allowed?: string) {
  vi.resetModules();
  if (allowed === undefined) delete process.env.COCKPIT_ALLOWED_ORIGINS;
  else process.env.COCKPIT_ALLOWED_ORIGINS = allowed;
  return (await import('./origin')).originAllowed;
}

afterEach(() => {
  delete process.env.COCKPIT_ALLOWED_ORIGINS;
});

describe('originAllowed', () => {
  it('allows everything when no allowlist is configured', async () => {
    const originAllowed = await load(undefined);
    expect(originAllowed('https://evil.example')).toBe(true);
    expect(originAllowed(undefined)).toBe(true);
  });

  it('lets non-browser clients without an Origin header through', async () => {
    const originAllowed = await load('https://cockpit.example');
    expect(originAllowed(undefined)).toBe(true);
  });

  it('admits only listed origins once an allowlist is set', async () => {
    const originAllowed = await load('https://a.example, https://b.example');
    expect(originAllowed('https://a.example')).toBe(true);
    expect(originAllowed('https://b.example')).toBe(true);
    expect(originAllowed('https://evil.example')).toBe(false);
  });

  it('trims whitespace and ignores empty entries in the env list', async () => {
    const originAllowed = await load('  https://a.example ,, ');
    expect(originAllowed('https://a.example')).toBe(true);
    expect(originAllowed('https://other.example')).toBe(false);
  });
});
