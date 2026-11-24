import { describe, it, expect } from 'vitest';
import { redactSecrets, isSensitivePath, MASK } from './redact-secrets';

const masked = (s: string) => expect(redactSecrets(s)).toContain(MASK);
const kept = (s: string) => expect(redactSecrets(s)).toBe(s);

describe('redactSecrets: recall', () => {
  it('provider keys', () => {
    const cases = [
      'sk-' + 'ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abc',
      'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
      'sk-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
      'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
      'gho_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
      'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ',
      'AIzaSyA1234567890abcdefghijklmnopqrstuv',
      'GOCSPX-abcdefghijklmnopqrstuvwx',
      'AKIA' + 'IOSFODNN7EXAMPLE',
      'xo' + 'xb-1234567890-abcdefghij',
      'sk_live_abcdefghijklmnop1234',
      'sbp_' + 'a'.repeat(40),
    ];
    for (const c of cases) {
      const out = redactSecrets(`key is ${c} here`);
      expect(out, c).toBe(`key is ${MASK} here`);
    }
  });

  it('Supabase JWT (anon / service_role)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dGhpc2lzYXNpZ25hdHVyZQ';
    expect(redactSecrets(`curl -H "apikey: ${jwt}"`)).not.toContain('eyJ');
    expect(redactSecrets(jwt)).toBe(MASK);
  });

  it('Bearer / assignments / flags', () => {
    expect(redactSecrets('Authorization: Bearer abc.def-ghi_123456')).toBe(`Authorization: Bearer ${MASK}`);
    expect(redactSecrets('https://x.io/cb?token=abc123xyz&page=2')).toBe(`https://x.io/cb?token=${MASK}&page=2`);
    expect(redactSecrets('password=hunter22')).toBe(`password=${MASK}`);
    expect(redactSecrets('secret=s3cr3t')).toBe(`secret=${MASK}`);
    expect(redactSecrets('api_key=zzz999')).toBe(`api_key=${MASK}`);
    expect(redactSecrets('{"password": "p@ss w0rd"}')).toBe(`{"password": ${MASK}}`);
    expect(redactSecrets('mysql --password hunter22 db')).toBe(`mysql --password ${MASK} db`);
    expect(redactSecrets('aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).not.toContain('wJalr');
  });

  it('.env lines whose key names a secret', () => {
    const env = [
      'SUPABASE_SERVICE_ROLE_KEY=abc',
      'GITHUB_TOKEN="quoted value"',
      'DB_PASSWORD=x',
      'STRIPE_SECRET=y',
      'export OPENAI_API_KEY=z',
      'MY_KEY=w',
    ].join('\n');
    const out = redactSecrets(env);
    for (const v of ['=abc', 'quoted value', '=x\n', '=y\n', '=z\n', '=w']) expect(out).not.toContain(v);
  });

  it('PEM private key blocks, even truncated', () => {
    const pem = '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk\nAAAA\n-----END OPENSSH PRIVATE KEY-----';
    expect(redactSecrets(`a\n${pem}\nb`)).toBe(`a\n${MASK}\nb`);
    expect(redactSecrets('-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIEow')).toBe(MASK);
  });

  it('URLs with credentials keep scheme and host', () => {
    expect(redactSecrets('postgres://admin:Pa55@db.host:5432/app')).toBe(`postgres://${MASK}@db.host:5432/app`);
    expect(redactSecrets('git clone https://user:ghtoken@github.com/x/y')).toBe(`git clone https://${MASK}@github.com/x/y`);
  });
});

describe('redactSecrets: precision (near-misses stay intact)', () => {
  it('git hashes, UUIDs, digests', () => {
    kept('45dd2d5c feat(team): meeting room with a blind first round (#1187)');
    kept('commit 9fceb02d0ae598e95dc970b74767f19372d61af8');
    kept('id 123e4567-e89b-12d3-a456-426614174000');
    kept('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    kept('integrity sha512-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789');
  });

  it('ordinary prose and code', () => {
    kept('const token = getToken();'.replace('= getToken()', '')); // "const token ;"
    kept('the token was rotated yesterday');
    kept('function getPassword() { return prompt(); }');
    kept('import { tokens } from "./primitives/tokens";');
    kept('ask for a password: then retry');
    kept('ssh-keygen -t ed25519');
    kept('https://github.com/x/y/pull/12');
    kept('git@github.com:org/repo.git');
    kept('const key = "id";'.replace('key', 'k'));
    kept('Bearer of bad news');
    kept('desk-ant-handle');
  });

  it('placeholders and references are not secrets', () => {
    kept('API_KEY=${API_KEY}');
    kept('PASSWORD=<your-password>');
    kept('token=');
    kept('SECRET=****');
    kept('TOKEN={{ secrets.TOKEN }}'.replace(' secrets.TOKEN ', 'x'));
  });

  it('is idempotent', () => {
    const once = redactSecrets('password=abc Bearer abcdefghij');
    expect(redactSecrets(once)).toBe(once);
  });
});

describe('isSensitivePath', () => {
  const home = '/home/u';
  it('flags secret files', () => {
    for (const p of [
      '/home/u/.ssh/id_ed25519', '~/.ssh/config', '/home/u/.deck-drop/x.txt',
      '/home/u/.config/dfl/prod.env', '/repo/.env', '/repo/.env.local', '/repo/app.env',
      '/repo/credentials.json', '/repo/credentials-prod.json', '/k/server.pem', '/home/u/.aws/credentials',
    ]) expect(isSensitivePath(p, home), p).toBe(true);
  });
  it('lets normal files through', () => {
    for (const p of ['/repo/server/env.ts', '/repo/.env.example.md', '/repo/README.md', '/repo/environment.ts', '/repo/creds.ts', '/home/u/.config/x/settings.json'])
      expect(isSensitivePath(p, home), p).toBe(false);
  });
});

describe('redactSecrets: masked helper', () => {
  it('flags Anthropic key inline', () => masked('x sk-ant-' + 'a'.repeat(30)));
});
