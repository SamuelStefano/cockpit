// Pure logic for the github-app edge function. No Deno globals, so vitest can import it.

export const TS_WINDOW_MS = 120_000
export const TOKEN_PERMISSIONS = { contents: 'write', pull_requests: 'write', metadata: 'read' } as const

export type Route = 'link' | 'status' | 'unlink' | 'token'

export function routeFor(method: string, pathname: string): Route | null {
  const idx = pathname.indexOf('/github-app')
  if (idx < 0) return null
  const rest = pathname.slice(idx + '/github-app'.length).replace(/\/+$/, '')
  if (method === 'POST' && rest === '/link') return 'link'
  if (method === 'GET' && rest === '/status') return 'status'
  if (method === 'POST' && rest === '/unlink') return 'unlink'
  if (method === 'POST' && rest === '/token') return 'token'
  return null
}

export function tsWithinWindow(ts: unknown, now: number, windowMs = TS_WINDOW_MS): boolean {
  return typeof ts === 'number' && Number.isFinite(ts) && Math.abs(now - ts) <= windowMs
}

export function signedMessage(ts: number, agentId: string): string {
  return `deck-gh-token.${ts}.${agentId}`
}

export function b64decode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function b64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function verifyAgentSignature(
  publicKeySpkiB64: string,
  ts: number,
  agentId: string,
  sigB64: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('spki', b64decode(publicKeySpkiB64), { name: 'Ed25519' }, false, ['verify'])
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      b64decode(sigB64),
      new TextEncoder().encode(signedMessage(ts, agentId)),
    )
  } catch {
    return false
  }
}

export function pemToPkcs8Der(pem: string): Uint8Array {
  if (pem.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error('GITHUB_APP_PRIVATE_KEY is PKCS#1; convert it with: openssl pkcs8 -topk8 -nocrypt -in key.pem')
  }
  const m = pem.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)
  if (!m) throw new Error('GITHUB_APP_PRIVATE_KEY is not a PKCS#8 PEM')
  return b64decode(m[1].replace(/\s+/g, ''))
}

export async function buildAppJwt(appId: string, pem: string, nowMs: number = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const nowS = Math.floor(nowMs / 1000)
  // iat is backdated to tolerate clock drift between us and GitHub.
  const payload = { iat: nowS - 60, exp: nowS + 9 * 60, iss: appId }
  const input = `${b64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64urlEncode(JSON.stringify(payload))}`
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input)))
  return `${input}.${b64urlEncode(sig)}`
}

export function corsHeaders(origin: string | null, allowedCsv: string | undefined): Record<string, string> {
  const allowed = (allowedCsv ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'origin',
  }
}
