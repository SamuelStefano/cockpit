import { useCallback, useEffect, useRef } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabase';
import { usePersisted, loadPref, savePref, setPref } from './persist';
import { AI_AVATAR_KEY, AI_AVATAR_DEFAULT } from '../components/aiAvatar';

// Perfil do usuário (nome, avatar, ícone da IA). Antes só no localStorage, então
// não acompanhava a conta em outro device/IP. Agora a fonte da verdade é a row
// `account` no Supabase (escrita client-side sob RLS = auth.uid()); o localStorage
// vira CACHE — pinta na hora e sobrevive offline/loopback. No loopback (Supabase
// desligado) nada muda: os setters só escrevem local, como sempre.

const NAME_KEY = 'user.name';
const AVATAR_KEY = 'user.avatar';

// Push com debounce por coluna: digitar o nome não dispara um UPDATE por tecla.
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
function pushRemote(userId: string, col: string, value: string): void {
  const prev = pushTimers.get(col);
  if (prev) clearTimeout(prev);
  pushTimers.set(col, setTimeout(() => {
    pushTimers.delete(col);
    // RLS restringe ao próprio id; valor vazio limpa a coluna (null).
    void supabase?.from('account').update({ [col]: value || null }).eq('id', userId);
  }, 400));
}

// Hook do MENU de perfil (único escritor): setters gravam o cache local na hora e,
// quando logado no produto multi-conta, empurram pro Supabase. Os demais avatares
// (UserAvatar/ClaudeAvatar/MessageView) só LEEM via usePersisted nas mesmas keys, e
// a hidratação remota os atualiza por setPref — sem precisar deste hook.
export function useProfile(userId?: string) {
  const [name, setNameLocal] = usePersisted<string>(NAME_KEY, '');
  const [avatar, setAvatarLocal] = usePersisted<string>(AVATAR_KEY, '');
  const [aiIcon, setAiIconLocal] = usePersisted<string>(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);
  const synced = SUPABASE_ENABLED && !!userId;

  const setName = useCallback((v: string) => {
    setNameLocal(v);
    if (synced) pushRemote(userId!, 'display_name', v);
  }, [synced, userId, setNameLocal]);
  const setAvatar = useCallback((v: string) => {
    setAvatarLocal(v);
    if (synced) pushRemote(userId!, 'avatar_url', v);
  }, [synced, userId, setAvatarLocal]);
  const setAiIcon = useCallback((v: string) => {
    setAiIconLocal(v);
    if (synced) pushRemote(userId!, 'ai_avatar', v);
  }, [synced, userId, setAiIconLocal]);

  return { name, avatar, aiIcon, setName, setAvatar, setAiIcon, synced };
}

// Hidratação na conexão/login. Busca a row da conta e sobrescreve o cache local
// (remoto vence) pra refletir o perfil em qualquer device. Troca de conta limpa o
// cache antes (não vaza o perfil da conta anterior). Migração one-time: se o
// remoto está vazio e havia perfil local (uso prévio no loopback), sobe o local.
export function useProfileHydration(userId: string | undefined): void {
  const prevUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return;
    const uid = userId;
    const switched = prevUid.current !== undefined && uid !== prevUid.current;
    prevUid.current = uid;
    // Troca de conta (ou logout): descarta o perfil cacheado da conta anterior.
    if (switched) {
      setPref(NAME_KEY, '');
      setPref(AVATAR_KEY, '');
      setPref(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);
    }
    if (!uid) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase!
        .from('account')
        .select('display_name, avatar_url, ai_avatar')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled || error || !data) return;

      const remoteEmpty = data.display_name == null && data.avatar_url == null && data.ai_avatar == null;
      // Flag GLOBAL (não por-uid): o perfil de loopback é "sem dono" e só pode subir
      // pra PRIMEIRA conta logada neste navegador. Depois disso o cache é sempre
      // escopado à conta, então jamais subimos o cache de uma conta pra outra.
      const everSynced = loadPref<boolean>('profile.everSynced', false);
      const localName = loadPref<string>(NAME_KEY, '');
      const localAvatar = loadPref<string>(AVATAR_KEY, '');
      const localIcon = loadPref<string>(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);

      if (remoteEmpty && !everSynced && (localName || localAvatar)) {
        // Migração one-time do perfil de loopback pra primeira conta (mantém o local).
        await supabase!.from('account').update({
          display_name: localName || null,
          avatar_url: localAvatar || null,
          ai_avatar: localIcon || null,
        }).eq('id', uid);
      } else if (!cancelled) {
        setPref(NAME_KEY, data.display_name ?? '');
        setPref(AVATAR_KEY, data.avatar_url ?? '');
        setPref(AI_AVATAR_KEY, data.ai_avatar ?? AI_AVATAR_DEFAULT);
      }
      savePref('profile.everSynced', true);
    })();
    return () => { cancelled = true; };
  }, [userId]);
}
