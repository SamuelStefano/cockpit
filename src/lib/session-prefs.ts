import { useEffect, useRef } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabase';
import { loadPref, setPref } from './persist';
import {
  readLocalAccountPrefs, mergeAccountPrefs, applyAccountPrefs, clearAccountPrefs,
  subscribeAccountPrefs, type AccountPrefs,
} from './account-prefs';

// Favoritos (pinned), etiquetas (tags) e as prefs de UI da conta
// ([[account-prefs.ts]]). Antes só no localStorage, então não acompanhavam a conta
// em outro device. Agora a fonte da verdade é a row
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

export function pushAccountPrefsRemote(userId: string, prefs: AccountPrefs): void {
  debouncePush('prefs', () => {
    const has = Object.keys(prefs).length > 0;
    void supabase?.from('account').update({ prefs: has ? prefs : null }).eq('id', userId);
  });
}

type AccountRow = Record<string, unknown>;

// `prefs` é da migration 0004: enquanto ela não roda no Supabase, pedir a coluna
// derruba o SELECT inteiro e levaria pins/tags junto. Degrada pro schema antigo em
// vez de deixar o deploy do SPA depender de ter aplicado o SQL antes.
async function readAccountRow(uid: string): Promise<{ data: AccountRow | null; hasPrefsColumn: boolean }> {
  const full = await supabase!.from('account').select('pinned_sessions, session_tags, prefs').eq('id', uid).maybeSingle();
  if (!full.error) return { data: full.data, hasPrefsColumn: true };
  const legacy = await supabase!.from('account').select('pinned_sessions, session_tags').eq('id', uid).maybeSingle();
  return { data: legacy.error ? null : legacy.data, hasPrefsColumn: false };
}

// Hidratação na conexão/login de TUDO que segue a conta e não é perfil: pins,
// tags e as prefs de UI ([[account-prefs.ts]]) — uma leitura só, o mesmo debounce
// de push. Mesmo desenho do perfil ([[profile.ts]]): troca de conta REAL (uid
// concreto → outro uid concreto) limpa o cache antes pra não vazar dado da conta
// anterior; blip transitório uid→undefined NÃO conta como troca.
export function useSessionPrefsHydration(userId: string | undefined): void {
  const prevUid = useRef<string | undefined>(undefined);
  // Antes da hidratação terminar este aparelho não sabe o que a conta tem: um push
  // agora gravaria pref stale (ou o default recém-limpo) por cima do remoto.
  const hydrated = useRef(false);
  const applying = useRef(false);

  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return;
    const uid = userId;
    const switched = prevUid.current != null && uid != null && uid !== prevUid.current;
    if (uid != null) prevUid.current = uid;
    hydrated.current = false;
    if (switched) {
      setPref(PINS_KEY, []);
      setPref(TAGS_KEY, {});
      clearAccountPrefs();
    }
    if (!uid) return;

    let cancelled = false;
    void (async () => {
      const row = await readAccountRow(uid);
      if (cancelled || !row.data) return;

      const remotePins = row.data.pinned_sessions as string[] | null;
      const remoteTags = row.data.session_tags as TagMap | null;
      const localPins = loadPref<string[]>(PINS_KEY, []);
      const localTags = loadPref<TagMap>(TAGS_KEY, {});

      const pins = resolvePref(remotePins, localPins, localPins.length > 0);
      const tags = resolvePref(remoteTags, localTags, Object.keys(localTags).length > 0);
      setPref(PINS_KEY, pins.value);
      setPref(TAGS_KEY, tags.value);

      const prefs = row.hasPrefsColumn
        ? mergeAccountPrefs(row.data.prefs as AccountPrefs | null, readLocalAccountPrefs())
        : null;
      if (prefs) {
        // Aplicar dispara os listeners das keys; sem a trava, o push de volta ecoaria
        // pro servidor o que acabou de chegar dele.
        applying.current = true;
        applyAccountPrefs(prefs.value);
        applying.current = false;
        hydrated.current = true;
      }

      if (pins.seed || tags.seed || prefs?.seed) {
        await supabase!.from('account').update({
          pinned_sessions: pins.value.length ? pins.value : null,
          session_tags: Object.keys(tags.value).length ? tags.value : null,
          ...(prefs ? { prefs: Object.keys(prefs.value).length ? prefs.value : null } : {}),
        }).eq('id', uid);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Escrita: qualquer mudança nas keys da conta (toggle no menu, /model no chat,
  // seletor de esforço) empurra o estado COMPLETO com o mesmo debounce de 400 ms.
  useEffect(() => {
    if (!SUPABASE_ENABLED || !userId) return;
    return subscribeAccountPrefs(() => {
      if (!hydrated.current || applying.current) return;
      pushAccountPrefsRemote(userId, readLocalAccountPrefs());
    });
  }, [userId]);
}
