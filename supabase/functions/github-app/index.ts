// GitHub App backend for Deck. Lets a box obtain short-lived installation tokens
// without any PAT or secret on the box.
//
// Secrets (Supabase Edge Function secrets, project deck-relay):
//   GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET,
//   DECK_ALLOWED_ORIGINS (comma list of browser origins)
//
// GITHUB_APP_PRIVATE_KEY must be PKCS#8 (WebCrypto cannot import PKCS#1). GitHub
// issues PKCS#1 ("BEGIN RSA PRIVATE KEY"), so convert before setting the secret:
//   openssl pkcs8 -topk8 -nocrypt -in github-key.pem -out github-key-pkcs8.pem
//
// Deploy with --no-verify-jwt: /token is called by boxes that hold no Supabase JWT
// (they sign with their Ed25519 identity). User routes validate the JWT themselves.
//   supabase functions deploy github-app --project-ref ikxtdssxmcgipyfpwmar --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  TOKEN_PERMISSIONS,
  buildAppJwt,
  corsHeaders,
  routeFor,
  tsWithinWindow,
  verifyAgentSignature,
} from './lib.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

const GH_HEADERS = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'deck-github-app' }

type Cors = Record<string, string>

function json(body: unknown, status: number, cors: Cors): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })
}

const unauthorized = (cors: Cors) => json({ error: 'unauthorized' }, 401, cors)

async function userIdFrom(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error || !data.user ? null : data.user.id
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function link(userId: string, body: Record<string, unknown>, cors: Cors) {
  const installationId = body.installation_id
  const code = body.code
  if (typeof installationId !== 'number' || !Number.isSafeInteger(installationId) || typeof code !== 'string' || !code) {
    return json({ error: 'bad_request' }, 400, cors)
  }
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: env('GITHUB_APP_CLIENT_ID'), client_secret: env('GITHUB_APP_CLIENT_SECRET'), code }),
  })
  const userToken = (await tokenRes.json().catch(() => ({})))?.access_token
  if (!tokenRes.ok || typeof userToken !== 'string') return json({ error: 'github_code_rejected' }, 400, cors)

  const instRes = await fetch('https://api.github.com/user/installations?per_page=100', {
    headers: { ...GH_HEADERS, authorization: `Bearer ${userToken}` },
  })
  if (!instRes.ok) return json({ error: 'github_error' }, 502, cors)
  const list = ((await instRes.json()).installations ?? []) as Array<{ id: number; app_id: number; account?: { login?: string } }>
  // The app_id check stops a user from linking an installation of someone else's app.
  const match = list.find((i) => i.id === installationId && String(i.app_id) === env('GITHUB_APP_ID'))
  if (!match) return json({ error: 'installation_not_found' }, 403, cors)

  const accountLogin = match.account?.login ?? ''
  const { error } = await admin
    .from('github_installation')
    .upsert({ account_id: userId, installation_id: installationId, account_login: accountLogin })
  if (error) return json({ error: 'db_error' }, 500, cors)
  return json({ ok: true, account_login: accountLogin }, 200, cors)
}

async function mintTokens(accountId: string) {
  const { data } = await admin.from('github_installation').select('installation_id, account_login').eq('account_id', accountId)
  const jwt = await buildAppJwt(env('GITHUB_APP_ID'), env('GITHUB_APP_PRIVATE_KEY'))
  const tokens: Array<{ account_login: string; token: string; expires_at: string }> = []
  for (const row of data ?? []) {
    const res = await fetch(`https://api.github.com/app/installations/${row.installation_id}/access_tokens`, {
      method: 'POST',
      headers: { ...GH_HEADERS, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: TOKEN_PERMISSIONS }),
    })
    if (!res.ok) continue
    const t = await res.json()
    tokens.push({ account_login: row.account_login, token: t.token, expires_at: t.expires_at })
  }
  return tokens
}

async function boxToken(body: Record<string, unknown>, cors: Cors) {
  const { agent_id: agentId, ts, sig } = body
  if (typeof agentId !== 'string' || typeof sig !== 'string' || typeof ts !== 'number') return unauthorized(cors)
  if (!tsWithinWindow(ts, Date.now())) return unauthorized(cors)
  const { data: agent } = await admin
    .from('agent')
    .select('account_id, public_key, kind, revoked_at')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent || agent.kind !== 'vps' || agent.revoked_at || !agent.public_key) return unauthorized(cors)
  if (!(await verifyAgentSignature(agent.public_key, ts, agentId, sig))) return unauthorized(cors)
  return json({ tokens: await mintTokens(agent.account_id) }, 200, cors)
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const route = routeFor(req.method === 'OPTIONS' ? 'POST' : req.method, url.pathname)
  // The box route is not a browser route: no CORS headers.
  const cors = route === 'token' ? {} : corsHeaders(req.headers.get('origin'), env('DECK_ALLOWED_ORIGINS'))
  if (req.method === 'OPTIONS') return new Response(null, { status: route ? 204 : 404, headers: cors })
  if (!route) return json({ error: 'not_found' }, 404, cors)

  try {
    if (route === 'token') return await boxToken(await readBody(req), cors)

    const userId = await userIdFrom(req)
    if (!userId) return unauthorized(cors)

    if (route === 'link') return await link(userId, await readBody(req), cors)
    if (route === 'status') {
      const { data } = await admin.from('github_installation').select('installation_id, account_login').eq('account_id', userId)
      return json({ installations: data ?? [] }, 200, cors)
    }
    const id = (await readBody(req)).installation_id
    if (typeof id !== 'number') return json({ error: 'bad_request' }, 400, cors)
    await admin.from('github_installation').delete().eq('account_id', userId).eq('installation_id', id)
    return json({ ok: true }, 200, cors)
  } catch {
    return json({ error: 'internal' }, 500, cors)
  }
})
