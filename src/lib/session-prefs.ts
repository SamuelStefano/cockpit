import { useEffect, useRef } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabase';
import { loadPref, setPref } from './persist';

// Favoritos (pinned) e etiquetas (tags) de sessão. Antes só no localStorage, então
// não acompanhavam a conta em outro device. Agora a fonte da verdade é a row
// `account` no Supabase (escrita client-side sob RLS = auth.uid()); o localStorage
// vira CACHE — pinta na hora e funciona no loopback (Supabase desligado), onde
// estes helpers ficam inertes.
//
// Modelo: a cada mutação o cliente empurra o ESTADO COMPLETO (debounced). Na
// hidratação o remoto, quando presente, substitui o local — assim desfavoritar/
// remover tag num device propaga (LWW), diferente de uma união que ressuscitaria
// o que foi removido. Conta antiga (coluna nula) sobe o que houver no local.

export const PINS_KEY = 'pinned';
export const TAGS_KEY = 'tags';

type TagMap = Record<string, string[]>;

const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
function debouncePush(col: string, fn: () => void): void {
  const prev = pushTimers.get(col);
  if (prev) clearTimeout(prev);
  pushTimers.set(col, setTimeout(() => { pushTimers.delete(col); fn(); }, 400));
}

export function syncEnabled(userId?: string): boolean {
  return SUPABASE_ENABLED && !!userId;
}

// Decisão pura da hidratação (testável sem Supabase): o remoto presente vence
// (deleção em outro device propaga); coluna nula = conta sem prefs no servidor,
// então mantém o local e marca pra semear o remoto com ele.
export function resolvePref<T>(remote: T | null, local: T, hasLocal: boolean): { value: T; seed: boolean } {
  if (remote != null) return { value: remote, seed: false };
  return { value: local, seed: hasLocal };
}

export function pushPinsRemote(userId: string, pins: string[]): void {
  debouncePush('pinned_sessions', () => {
    void supabase?.from('account').update({ pinned_sessions: pins.length ? pins : null }).eq('id', userId);
  });
}

export function pushTagsRemote(userId: string, tags: TagMap): void {
  debouncePush('session_tags', () => {
    const has = Object.keys(tags).length > 0;
    void supabase?.from('account').update({ session_tags: has ? tags : null }).eq('id', userId);
  });
}

// Hidratação na conexão/login. Mesmo desenho do perfil ([[profile.ts]]): troca de
// conta REAL (uid concreto → outro uid concreto) limpa o cache antes pra não vazar
// pins/tags da conta anterior; blip transitório uid→undefined NÃO conta como troca.
export function useSessionPrefsHydration(userId: string | undefined): void {
  const prevUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return;
    const uid = userId;
    const switched = prevUid.current != null && uid != null && uid !== prevUid.current;
    if (uid != null) prevUid.current = uid;
    if (switched) {
      setPref(PINS_KEY, []);
      setPref(TAGS_KEY, {});
    }
    if (!uid) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase!
        .from('account')
        .select('pinned_sessions, session_tags')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled || error || !data) return;

      const remotePins = data.pinned_sessions as string[] | null;
      const remoteTags = data.session_tags as TagMap | null;
      const localPins = loadPref<string[]>(PINS_KEY, []);
      const localTags = loadPref<TagMap>(TAGS_KEY, {});

      const pins = resolvePref(remotePins, localPins, localPins.length > 0);
      const tags = resolvePref(remoteTags, localTags, Object.keys(localTags).length > 0);
      setPref(PINS_KEY, pins.value);
      setPref(TAGS_KEY, tags.value);

      if (pins.seed || tags.seed) {
        await supabase!.from('account').update({
          pinned_sessions: pins.value.length ? pins.value : null,
          session_tags: Object.keys(tags.value).length ? tags.value : null,
        }).eq('id', uid);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
}
