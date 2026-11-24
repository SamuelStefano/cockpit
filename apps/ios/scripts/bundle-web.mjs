#!/usr/bin/env node
// The bundle step of the store build .
//
//   node apps/ios/scripts/bundle-web.mjs              # vite build at the repo root, then copy
//   node apps/ios/scripts/bundle-web.mjs --from DIR   # copy an existing web build (DIR/index.html)
//
// It writes `apps/ios/modules/dfl-web-bundle/ios/web/`. The podspec of the module copies that
// folder into the app as `web/`, and the scheme handler serves it on `<scheme>://localhost`.
// The absolute `/assets/` paths of the unchanged Vite build work on that origin (they break only on file://). The web build reads its VITE_* values from the environment, as
// Dockerfile.web does; VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_WS_URL must be set, or the
// step refuses (a bundle without them cannot reach Supabase or the relay). They are public by design
// (bundled), never a service-role key or any other secret.
//
// EAS: `eas-build-post-install` runs this when DECK_WEB_BUNDLE=1 (the bundle variant).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const APP_DIR = resolve(here, '..');
export const REPO_ROOT = resolve(APP_DIR, '../..');
export const TARGET = join(APP_DIR, 'modules/dfl-web-bundle/ios/web');

/** Checks on a web build before it goes into the app. Returns the list of problems. */
export function checkWebBuild(dir) {
  const problems = [];
  const indexPath = join(dir, 'index.html');
  if (!existsSync(indexPath)) return [`${indexPath} is missing`];
  const html = readFileSync(indexPath, 'utf8');
  const refs = [...html.matchAll(/\s(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  if (refs.length === 0) problems.push('index.html references no /assets/ file (not a Vite build?)');
  for (const ref of refs) if (!existsSync(join(dir, ref))) problems.push(`index.html references ${ref}, which is missing`);
  if (/\s(?:src|href)="https?:\/\/deck\.devfellowship\.com\/assets\//.test(html)) {
    problems.push('index.html loads its assets from the prod URL (the bundle must be self-contained)');
  }
  return problems;
}

/** True for a key that must never ship in an app: a `sb_secret_` key, or a JWT with role `service_role`. */
export function isSecretKey(key) {
  const k = String(key ?? '').trim();
  if (k.startsWith('sb_secret_')) return true;
  const part = k.split('.')[1];
  if (!part) return false;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))?.role === 'service_role';
  } catch {
    return false;
  }
}

function viteBuild() {
  for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_WS_URL']) {
    if (!process.env[key]?.trim()) throw new Error(`${key} is not set: the bundled web build needs it (see the ARGs of Dockerfile.web)`);
  }
  if (isSecretKey(process.env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error('VITE_SUPABASE_ANON_KEY is a secret (service_role) key: refused, it would ship inside the app');
  }
  const out = mkdtempSync(join(tmpdir(), 'deck-web-bundle-'));
  execFileSync('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=2048' },
  });
  return out;
}

export function bundleWeb({ from } = {}) {
  const source = from ? resolve(from) : viteBuild();
  const problems = checkWebBuild(source);
  if (problems.length) throw new Error(`the web build is not usable:\n- ${problems.join('\n- ')}`);
  rmSync(TARGET, { recursive: true, force: true });
  cpSync(source, TARGET, { recursive: true, dereference: true });
  writeFileSync(
    join(TARGET, 'bundle-info.json'),
    `${JSON.stringify({ builtAt: new Date().toISOString(), buildSha: process.env.VITE_BUILD_SHA ?? null, from: from ? 'copy' : 'vite build' }, null, 2)}\n`,
  );
  return TARGET;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--from');
  const from = i > 0 ? process.argv[i + 1] : undefined;
  try {
    console.log(`web bundle -> ${bundleWeb({ from })}`);
  } catch (e) {
    console.error(`bundle-web: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
