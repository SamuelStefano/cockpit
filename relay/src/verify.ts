import { createPublicKey, verify as edVerify, randomBytes } from 'node:crypto';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { roleFromIdentity, type AccountRole } from '../../shared/identity';

// Verificação de identidade do relay (DR-023). Dois caminhos SEPARADOS (não estende
// o token binário): browser = JWT Supabase via JWKS; agente = assinatura Ed25519 de
// um challenge. O relay só guarda material PÚBLICO (JWKS + pubkeys). Nada aqui spawna.

export interface Identity {
  accountId: string;     // = sub do JWT (server-side, red line #1)
  email: string;
  role: AccountRole;
}

// Valida os claims já decodificados de um JWT Supabase. PURA (sem rede): checa
// issuer exato, audience 'authenticated', expiração, e extrai sub/email. Devolve
// null em qualquer falha → o chamador trata como identidade falha → fellow.
export function validateClaims(
  claims: Record<string, unknown> | null | undefined,
  opts: { iss: string; nowSec: number; rootEmails: ReadonlySet<string>; isAdmin: boolean },
): Identity | null {
  if (!claims) return null;
  const { iss, sub, email, aud, exp } = claims as {
    iss?: string; sub?: string; email?: string; aud?: string | string[]; exp?: number;
  };
  if (iss !== opts.iss) return null;
  const auds = Array.isArray(aud) ? aud : [aud];
  if (!auds.includes('authenticated')) return null;
  if (typeof exp !== 'number' || exp <= opts.nowSec) return null;
  if (!sub || !email) return null;
  return { accountId: sub, email, role: roleFromIdentity(email, opts.isAdmin, opts.rootEmails) };
}

// Wrapper com jose: verifica assinatura do JWT contra o JWKS (cacheado) e devolve os
// claims crus, pra passar a validateClaims. Algoritmos fixados (anti-downgrade).
export type JwksFn = ReturnType<typeof createRemoteJWKSet>;
export function makeJwks(jwksUrl: string): JwksFn {
  return createRemoteJWKSet(new URL(jwksUrl));
}
export async function verifyJwtSignature(token: string, jwks: JwksFn, iss: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: iss,
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256'],
      clockTolerance: 5,
    });
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Challenge aleatório que o relay manda ao agente reconectar; o agente assina com a
// privada (que nasceu e ficou na VPS dele). 32 bytes base64url.
export function makeChallenge(): string {
  return randomBytes(32).toString('base64url');
}

// Verifica a assinatura Ed25519 do agente sobre o challenge. publicKeyB64 = SPKI DER
// em base64 (o que o agente registrou no pairing). PURA (node:crypto), sem rede.
// Qualquer erro → false (default-deny).
export function verifyAgentSignature(publicKeyB64: string, challenge: string, signatureB64: string): boolean {
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' });
    return edVerify(null, Buffer.from(challenge), key, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}
