// Server-side secret scrubbing for anything that leaves the box as "what the
// agent is doing" (live stream, terminal tail). Precision matters as much as
// recall: plain hashes, UUIDs and ordinary words must survive untouched, so
// every pattern is anchored on a known prefix or on a secret-looking key name.

export const MASK = '••••';
export const SENSITIVE_FILE_NOTE = '(arquivo sensível oculto)';

// Value of a KEY=VALUE / key: value assignment: quoted, or up to whitespace/;/,/&.
const VALUE = String.raw`(?:"[^"\n]*"|'[^'\n]*'|[^\s"'&;,]+)`;

type Rule = { re: RegExp; to: string | ((...m: string[]) => string) };

const RULES: Rule[] = [
  // PEM private key blocks (RSA/EC/OPENSSH/PGP/plain), including a cut-off block.
  { re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----|$)/g, to: MASK },
  // Orphan END (the BEGIN was cut off, e.g. scrolled out of a terminal window):
  // everything before it may be key body. Runs after the full-block rule.
  { re: /^[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/g, to: MASK },
  // URLs with credentials: scheme://user:pass@host -> keep scheme and host.
  { re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:'"]+:[^\s/@'"]+@/gi, to: (_m, scheme) => `${scheme}${MASK}@` },
  // Anthropic, then OpenAI (sk-, sk-proj-), both before the generic rules.
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, to: MASK },
  { re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g, to: MASK },
  // GitHub: classic/OAuth/app/refresh tokens and fine-grained PATs.
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g, to: MASK },
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}/g, to: MASK },
  // Google API key and OAuth client secret.
  { re: /\bAIza[0-9A-Za-z_-]{35}/g, to: MASK },
  { re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/g, to: MASK },
  // AWS access key id.
  { re: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g, to: MASK },
  // Slack / Stripe / Supabase personal tokens.
  { re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, to: MASK },
  { re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g, to: MASK },
  { re: /\bsbp_[a-f0-9]{40}\b/g, to: MASK },
  // JWT (Supabase anon/service_role and every other): three base64url parts, header starts with eyJ.
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, to: MASK },
  // Authorization headers.
  { re: /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/g, to: (_m, k) => `${k} ${MASK}` },
  // aws_secret_access_key = <40 chars>
  { re: /\b(aws_secret_access_key\s*[=:]\s*)["']?[A-Za-z0-9/+=]{40}["']?/gi, to: (_m, k) => `${k}${MASK}` },
  // KEY=VALUE / key: value where the key names a secret (.env, query strings, JSON-ish, CLI flags).
  {
    re: new RegExp(
      String.raw`(["']?\b(?:[A-Za-z0-9_.-]*?(?:SECRET|TOKEN|PASSWORD|PASSWD|PWD|API[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|AUTH|CREDENTIALS?)|[A-Z0-9_]*_KEY|token|password|secret|api_key|apikey)["']?\s*(?:=|:\s|:(?=["']))\s*)(${VALUE})`,
      'gi',
    ),
    to: (m, k, v) => (isPlaceholder(v) || proseColon(k, v) ? m : `${k}${MASK}`),
  },
  // --password xyz / --token xyz CLI flags.
  { re: /(--(?:password|token|secret|api-key|apikey)[ =])(\S+)/gi, to: (_m, k) => `${k}${MASK}` },
];

// `password: then retry` is prose: a colon form with an unquoted key and value
// only counts when the value looks machine-made (has a digit or symbol).
function proseColon(k: string, v: string): boolean {
  return !k.includes('=') && !/["']/.test(k) && !/^["']/.test(v) && !/[0-9_\-/+=.@]/.test(v);
}

// A value that is already masked, empty, or a reference (env var, template) is not a secret.
function isPlaceholder(v: string): boolean {
  const s = v.replace(/^["']|["']$/g, '');
  return s === '' || s.includes(MASK) || /^\$\{?[A-Za-z_]/.test(s) || /^<[^>]*>$/.test(s) || /^\*+$/.test(s)
    || /^(?:true|false|null|undefined|none)$/i.test(s) || /^\{\{.*\}\}$/.test(s);
}

export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, to } of RULES) out = out.replace(re, to as any);
  return out;
}

// Files whose content never leaves the box, whatever it looks like.
export function isSensitivePath(path: string, home = process.env.HOME ?? ''): boolean {
  if (!path) return false;
  let p = path.replace(/\\/g, '/');
  if (home && (p === home || p.startsWith(`${home}/`))) p = `~${p.slice(home.length)}`;
  const base = p.split('/').pop() ?? '';
  if (/(^|\/)\.ssh(\/|$)/.test(p) || /(^|\/)\.deck-drop(\/|$)/.test(p)) return true;
  if (/(^|\/)\.config\/[^/]+\/[^/]*\.env$/.test(p)) return true;
  if (/^\.env(\.[^.]+)?$/.test(base) || /\.env$/.test(base)) return true;
  if (/^credentials.*\.json$/i.test(base)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(base) || /\.(pem|key|p12|pfx)$/i.test(base)) return true;
  if (/(^|\/)\.(aws|gnupg)\//.test(p) || base === '.netrc' || base === '.pgpass' || base === '.npmrc') return true;
  return false;
}

// Cap by UTF-16 length; the tail keeps the end (terminal), the head keeps the start (diff).
export function capHead(s: string, max: number): { text: string; truncated: boolean } {
  return s.length > max ? { text: s.slice(0, max), truncated: true } : { text: s, truncated: false };
}
