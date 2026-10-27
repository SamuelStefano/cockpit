import { PRF_SALT, deriveFromPrf } from '../../shared/e2e/passkey';
import { randomBytes, utf8, type Bytes } from '../../shared/e2e/bytes';
import { sha256 } from '../../shared/e2e/channel';
import { adoptPasskey } from './device-store';

// The only WebAuthn code: it gets the PRF output and hands it to
// shared/e2e/passkey.ts, which everything after it (and its tests) goes through.
// Discoverable credential and an empty allowCredentials, so no credential id is
// stored anywhere; the challenge is local because nothing server-side verifies
// the assertion: what matters is the PRF output, which only the authenticator
// can produce, after user verification.

export type PasskeyOutcome = 'ok' | 'unsupported';

interface PrfResults { prf?: { enabled?: boolean; results?: { first?: BufferSource } } }

export function webauthnAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && !!navigator.credentials;
}

const prfInput = () => ({ prf: { eval: { first: PRF_SALT } } }) as unknown as AuthenticationExtensionsClientInputs;

function prfOutput(cred: Credential | null): { enabled: boolean; out: Bytes | null } {
  const r = (cred as PublicKeyCredential | null)?.getClientExtensionResults() as PrfResults | undefined;
  const first = r?.prf?.results?.first;
  const view = first ? (ArrayBuffer.isView(first) ? new Uint8Array(first.buffer, first.byteOffset, first.byteLength) : new Uint8Array(first)) : null;
  const out: Bytes | null = view ? view.slice() : null;
  return { enabled: r?.prf?.enabled === true || !!out, out: out && out.length === 32 ? out : null };
}

async function assertion(): Promise<Bytes | null> {
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: location.hostname,
      allowCredentials: [],
      userVerification: 'required',
      extensions: prfInput(),
    },
  });
  return prfOutput(cred).out;
}

async function create(user: { id: string; name: string }): Promise<{ enabled: boolean; out: Bytes | null }> {
  const cred = await navigator.credentials.create({
    publicKey: {
      rp: { id: location.hostname, name: 'Deck' },
      // Stable per account, so creating again replaces the passkey instead of
      // piling up copies; hashed, since the handle must not carry user data.
      user: { id: (await sha256(utf8(`deck-passkey-user/${user.id}`))).slice(0, 16), name: user.name, displayName: user.name },
      challenge: randomBytes(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
      extensions: prfInput(),
    },
  });
  return prfOutput(cred);
}

// Some authenticators report PRF as enabled at creation but only evaluate it on
// a `get`, hence the second prompt in that case.
export async function unlockWithPasskey(mode: 'get' | 'create', user: { id: string; name: string }): Promise<PasskeyOutcome> {
  let out: Bytes | null;
  if (mode === 'create') {
    const made = await create(user);
    if (!made.enabled) return 'unsupported';
    out = made.out ?? (await assertion());
  } else {
    out = await assertion();
  }
  if (!out) return 'unsupported';
  try { await adoptPasskey(await deriveFromPrf(out)); } finally { out.fill(0); }
  return 'ok';
}
