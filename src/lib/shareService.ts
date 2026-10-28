import { supabase } from './supabase';
import { buildShareSnapshot, shareId, sharePath } from './share';
import type { Message } from '../data/types';

const KEY = 'cockpit:shares';

export interface StoredShare { path: string; url: string; title: string }

export function listShares(): StoredShare[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((s) => s && typeof s.path === 'string' && typeof s.url === 'string') : [];
  } catch { return []; }
}

const save = (list: StoredShare[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: revoke list is best-effort */ }
};

async function requireUid() {
  if (!supabase) throw new Error('Compartilhamento indisponível: login não configurado');
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Entre na sua conta para compartilhar');
  return uid;
}

export async function createShare(title: string, messages: Message[]): Promise<StoredShare> {
  const uid = await requireUid();
  const id = shareId();
  const path = sharePath(uid, id);
  const blob = new Blob([JSON.stringify(buildShareSnapshot(title, messages))], { type: 'application/json' });
  const { error } = await supabase!.storage.from('shares').upload(path, blob, { contentType: 'application/json', upsert: false });
  if (error) throw new Error(error.message);
  const share = { path, url: `${location.origin}/s/${uid}/${id}`, title };
  save([...listShares(), share]);
  return share;
}

export async function revokeShare(path: string): Promise<void> {
  await requireUid();
  const { error } = await supabase!.storage.from('shares').remove([path]);
  if (error) throw new Error(error.message);
  save(listShares().filter((s) => s.path !== path));
}
