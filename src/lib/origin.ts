// Links that leave the app (share, password reset, device enrollment) must carry a
// real https origin. In the browser that is location.origin, as always. A bundled
// build runs on a custom scheme, where location.origin is useless to anyone else, so
// it falls back to VITE_PUBLIC_ORIGIN, then to the production site.
export const CANONICAL_ORIGIN = 'https://deck.devfellowship.com';

interface Loc { protocol: string; origin: string }

function httpsOrigin(raw: string | undefined): string {
  try {
    const u = new URL((raw ?? '').trim());
    return u.protocol === 'https:' ? u.origin : '';
  } catch { return ''; }
}

export function resolveAppOrigin(loc: Loc | undefined, envOrigin: string | undefined): string {
  const fromEnv = httpsOrigin(envOrigin);
  if (fromEnv) return fromEnv;
  if (loc && (loc.protocol === 'https:' || loc.protocol === 'http:')) return loc.origin;
  return CANONICAL_ORIGIN;
}

export function appOrigin(): string {
  return resolveAppOrigin(typeof location === 'undefined' ? undefined : location, import.meta.env.VITE_PUBLIC_ORIGIN);
}
