/**
 * The origin of the web content in the shell, and the one navigation decision.
 *
 * Store build (`production-bundle`): the bundled web build on `<scheme>://localhost`, served by the
 * WKURLSchemeHandler of `modules/dfl-web-bundle`. Profile `production` (TestFlight only): the live
 * https origin. The origin is ONE config value, `expo.extra.webOrigin`; app.config.js sets it to the
 * bundle origin only in the bundle variant.
 *
 * The bundle origin is accepted only when the native module reports the same scheme, an installed
 * handler and a present bundle. Otherwise the shell falls back to the public https origin, so a broken
 * native step cannot ship a blank WebView.
 *
 * Origins are compared with `originOf`, never `URL.origin`: Node and Hermes give a custom scheme the
 * opaque origin "null".
 *
 * Pure TypeScript: no React Native import.
 */
export const DEFAULT_WEB_ORIGIN = 'https://deck.devfellowship.com';

/** The host of a bundle origin. The scheme handler serves this host only. */
export const BUNDLE_HOST = 'localhost';

/**
 * Hosts, besides the app origin, that may load inside the shell (exact host, https, default port):
 * the relay and the auth backend the web app talks to. Everything else opens outside the app.
 */
export const ALLOWED_HOSTS: readonly string[] = ['deck-relay.devfellowship.com', 'ikxtdssxmcgipyfpwmar.supabase.co'];

/** Schemes that WebKit handles itself: `setURLSchemeHandler` throws for them. */
const RESERVED_SCHEMES = new Set(['http', 'https', 'file', 'about', 'blob', 'data', 'javascript', 'ws', 'wss', 'ftp']);

/** A scheme name that the native handler may own (lower case, RFC 3986 syntax, not reserved). */
export function isBundleScheme(scheme: unknown): scheme is string {
  return typeof scheme === 'string' && /^[a-z][a-z0-9+.-]*$/.test(scheme) && !RESERVED_SCHEMES.has(scheme);
}

export const bundleOrigin = (scheme: string): string => `${scheme}://${BUNDLE_HOST}`;

/**
 * scheme://host[:port] of a URL string, normalised (lower case, trailing dot, default port, user info
 * dropped), or null when it is not a hierarchical URL.
 */
export function originOf(url: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(url.trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  let authority = m[2];
  const at = authority.lastIndexOf('@');
  if (at >= 0) authority = authority.slice(at + 1);
  const pm = /^(.*?)(?::(\d*))?$/.exec(authority);
  let host = (pm?.[1] ?? authority).toLowerCase().replace(/\.$/, '');
  let port = pm?.[2] ?? '';
  if ((scheme === 'https' && port === '443') || (scheme === 'http' && port === '80')) port = '';
  if (!host) return null;
  if (host.startsWith('[') && !host.endsWith(']')) host = `${host}]`;
  return `${scheme}://${host}${port ? `:${port}` : ''}`;
}

/** Read an https origin from a config value; with no value, the production origin. Throws on anything else. */
export function parseWebOrigin(value: unknown): string {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_WEB_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`expo.extra.webOrigin is not a URL: ${raw}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`expo.extra.webOrigin must be https (a custom scheme needs the native bundle handler): ${raw}`);
  }
  if (url.pathname !== '/' || url.search || url.hash) throw new Error(`expo.extra.webOrigin must be an origin with no path: ${raw}`);
  return url.origin;
}

/** What `modules/dfl-web-bundle` reports. `null`: the binary has no such module (Expo Go). */
export interface WebBundleStatus {
  scheme: string | null;
  installed: boolean;
  bundlePresent: boolean;
  detail?: string;
}

export interface ShellOrigin {
  /** The origin the WebView loads and the bridge accepts. */
  origin: string;
  /** The public https origin: the fallback. */
  publicOrigin: string;
  bundled: boolean;
  /** Set when a bundle origin was configured but the shell fell back to https. */
  fallback?: string;
}

export function resolveShellOrigin(webOrigin: unknown, publicWebOrigin: unknown, native: WebBundleStatus | null): ShellOrigin {
  const publicOrigin = parseWebOrigin(publicWebOrigin);
  const raw = typeof webOrigin === 'string' && webOrigin.trim() ? webOrigin.trim() : publicOrigin;
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)\/?$/i.exec(raw);
  const scheme = m?.[1].toLowerCase();
  if (!m || scheme === 'https' || scheme === 'http' || scheme === 'file') {
    return { origin: parseWebOrigin(raw), publicOrigin, bundled: false };
  }
  if (!isBundleScheme(scheme) || m[2].toLowerCase() !== BUNDLE_HOST) {
    throw new Error(`expo.extra.webOrigin must be https or <scheme>://${BUNDLE_HOST}: ${raw}`);
  }
  const why =
    native === null
      ? 'the binary has no DflWebBundle module'
      : native.scheme !== scheme
        ? `Info.plist DflWebBundleScheme is ${native.scheme ?? 'not set'}, the config asks for ${scheme}`
        : !native.installed
          ? `the scheme handler is not installed${native.detail ? ` (${native.detail})` : ''}`
          : !native.bundlePresent
            ? 'web/index.html is not in the app bundle'
            : null;
  if (why) return { origin: publicOrigin, publicOrigin, bundled: false, fallback: why };
  return { origin: bundleOrigin(scheme), publicOrigin, bundled: true };
}

export type NavigationDecision = 'load' | 'external' | 'block';

/**
 * What the WebView does with a navigation request. `appOrigin` is the app origin (https or the
 * bundle origin). One function, called from `onShouldStartLoadWithRequest`.
 *
 * - `load`: the app origin, `about:`, and the ALLOWED_HOSTS over https. A sub-frame also loads
 *   `blob:` and `data:`.
 * - `block`: a TOP-frame `blob:` or `data:` (WKWebView would show the blob full-screen with no way
 *   back), and `javascript:`.
 * - `external`: everything else, `mailto:` and `tel:` included. iOS opens it outside the shell.
 */
export function navigationDecision(url: string, appOrigin: string, isTopFrame: boolean): NavigationDecision {
  const u = url.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)?.[1].toLowerCase();
  if (!scheme) return 'block';
  if (scheme === 'about') return 'load';
  if (scheme === 'javascript') return 'block';
  if (scheme === 'blob' || scheme === 'data') return isTopFrame ? 'block' : 'load';
  const origin = originOf(u);
  if (!origin) return 'external';
  if (origin === originOf(appOrigin)) return 'load';
  if (scheme === 'https') {
    const host = origin.slice('https://'.length);
    if (ALLOWED_HOSTS.includes(host)) return 'load';
  }
  return 'external';
}
