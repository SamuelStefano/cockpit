import { supabase } from './supabase';

export interface GithubInstallation { installation_id: number; account_login: string }

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
const slug = (import.meta.env.VITE_GITHUB_APP_SLUG ?? '').trim();

export const GITHUB_APP_ENABLED = !!(supabase && url && anon && slug);
export const githubInstallUrl = (s = slug): string => `https://github.com/apps/${s}/installations/new`;

type Call = (path: string, init?: { method: string; body?: unknown }) => Promise<Response>;

async function realCall(path: string, init?: { method: string; body?: unknown }): Promise<Response> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (!session) throw new Error('sem sessão');
  return fetch(`${url}/functions/v1/github-app${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: anon, 'content-type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`github-app ${res.status}`);
  return (await res.json()) as T;
}

export async function linkInstallation(installationId: number, code: string, call: Call = realCall): Promise<string> {
  const r = await json<{ account_login: string }>(await call('/link', { method: 'POST', body: { installation_id: installationId, code } }));
  return r.account_login;
}

export async function githubStatus(call: Call = realCall): Promise<GithubInstallation[]> {
  return (await json<{ installations: GithubInstallation[] }>(await call('/status'))).installations ?? [];
}

export async function unlinkInstallation(installationId: number, call: Call = realCall): Promise<void> {
  await json(await call('/unlink', { method: 'POST', body: { installation_id: installationId } }));
}
