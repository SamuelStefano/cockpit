// A managed env var name. The server refuses anything else; the admin form checks
// it first, so a typo does not throw away the secret typed next to it.
export const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validEnvName(name: string): boolean {
  return ENV_NAME_RE.test(name);
}
