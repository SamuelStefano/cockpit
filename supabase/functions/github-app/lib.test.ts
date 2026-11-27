import { generateKeyPairSync, createVerify, sign as nodeSign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { b64decode, buildAppJwt, corsHeaders, pemToPkcs8Der, routeFor, signedMessage, tsWithinWindow, verifyAgentSignature } from './lib'

describe('tsWithinWindow', () => {
  it('accepts within 120s and rejects beyond', () => {
    expect(tsWithinWindow(1_000_000, 1_000_000 + 120_000)).toBe(true)
    expect(tsWithinWindow(1_000_000, 1_000_000 - 120_000)).toBe(true)
    expect(tsWithinWindow(1_000_000, 1_000_000 + 120_001)).toBe(false)
    expect(tsWithinWindow('1', 1)).toBe(false)
  })
})

describe('signature', () => {
  it('formats the message', () => {
    expect(signedMessage(123, 'abc')).toBe('deck-gh-token.123.abc')
  })

  it('verifies a real Ed25519 signature and rejects tampering', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
    const sig = nodeSign(null, Buffer.from(signedMessage(5, 'agent-1')), privateKey).toString('base64')
    expect(await verifyAgentSignature(spki, 5, 'agent-1', sig)).toBe(true)
    expect(await verifyAgentSignature(spki, 6, 'agent-1', sig)).toBe(false)
    expect(await verifyAgentSignature(spki, 5, 'agent-2', sig)).toBe(false)
    expect(await verifyAgentSignature('not-a-key', 5, 'agent-1', sig)).toBe(false)
  })
})

describe('app JWT', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
  const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }) as string

  it('builds a valid RS256 JWT', async () => {
    const now = 1_700_000_000_000
    const jwt = await buildAppJwt('12345', pkcs8, now)
    const [h, p, s] = jwt.split('.')
    const dec = (x: string) => JSON.parse(new TextDecoder().decode(b64decode(x)))
    expect(dec(h)).toEqual({ alg: 'RS256', typ: 'JWT' })
    const payload = dec(p)
    expect(payload.iss).toBe('12345')
    expect(payload.iat).toBe(now / 1000 - 60)
    expect(payload.exp - now / 1000).toBeLessThanOrEqual(600)
    const v = createVerify('RSA-SHA256').update(`${h}.${p}`)
    expect(v.verify(publicKey, Buffer.from(b64decode(s)))).toBe(true)
  })

  it('rejects PKCS#1 with a clear error', () => {
    expect(() => pemToPkcs8Der(pkcs1)).toThrow(/PKCS#1/)
  })
})

describe('routing and cors', () => {
  it('dispatches known routes and 404s the rest', () => {
    expect(routeFor('POST', '/github-app/link')).toBe('link')
    expect(routeFor('GET', '/functions/v1/github-app/status')).toBe('status')
    expect(routeFor('POST', '/github-app/unlink')).toBe('unlink')
    expect(routeFor('POST', '/github-app/token/')).toBe('token')
    expect(routeFor('GET', '/github-app/token')).toBeNull()
    expect(routeFor('POST', '/github-app/nope')).toBeNull()
    expect(routeFor('GET', '/other')).toBeNull()
  })

  it('allows only listed origins', () => {
    expect(corsHeaders('https://a.com', 'https://a.com, https://b.com')['access-control-allow-origin']).toBe('https://a.com')
    expect(corsHeaders('https://evil.com', 'https://a.com')).toEqual({})
    expect(corsHeaders(null, undefined)).toEqual({})
  })
})
