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
  it('denies a foreign browser origin by default (no allowlist) — closes the CSWSH drive-by', async () => {
    const originAllowed = await load(undefined);
    expect(originAllowed('https://evil.example')).toBe(false);
    expect(originAllowed(undefined)).toBe(true);
  });

  it('allows local origins by default so the vite dev front and loopback-served app keep working', async () => {
    const originAllowed = await load(undefined);
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(originAllowed('http://127.0.0.1:7777')).toBe(true);
    expect(originAllowed('http://localhost')).toBe(true);
  });

  it('lets non-browser clients without an Origin header through', async () => {
    const originAllowed = await load('https://cockpit.example');
    expect(originAllowed(undefined)).toBe(true);
  });

  it('admits listed origins (plus always-local) once an allowlist is set', async () => {
    const originAllowed = await load('https://a.example, https://b.example');
    expect(originAllowed('https://a.example')).toBe(true);
    expect(originAllowed('https://b.example')).toBe(true);
    expect(originAllowed('http://localhost:5173')).toBe(true);
    expect(originAllowed('https://evil.example')).toBe(false);
  });

  it('does not match a look-alike host that merely contains localhost', async () => {
    const originAllowed = await load(undefined);
    expect(originAllowed('https://localhost.evil.example')).toBe(false);
    expect(originAllowed('http://127.0.0.1.evil.example')).toBe(false);
  });

  it('trims whitespace and ignores empty entries in the env list', async () => {
    const originAllowed = await load('  https://a.example ,, ');
    expect(originAllowed('https://a.example')).toBe(true);
    expect(originAllowed('https://other.example')).toBe(false);
  });
});
