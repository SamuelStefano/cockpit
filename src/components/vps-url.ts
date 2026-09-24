// A plain ws:// to a public host carries the COCKPIT_TOKEN (and every prompt and
// terminal byte) in clear text. Loopback never leaves the box, and a Tailscale
// address rides WireGuard, so those two are fine.
export function insecureWsUrl(raw: string): boolean {
  const u = raw.trim();
  if (!/^ws:\/\//i.test(u)) return false;
  let host: string;
  try { host = new URL(u).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return false; }
  if (host === 'localhost' || host === '::1' || /^127\./.test(host)) return false;
  if (host.endsWith('.ts.net')) return false;
  const m = /^100\.(\d+)\./.exec(host);
  if (m && Number(m[1]) >= 64 && Number(m[1]) <= 127) return false; // 100.64.0.0/10 (Tailscale CGNAT)
  return true;
}
