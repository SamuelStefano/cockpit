import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_ENABLED } from './supabase';
import { usePersisted, loadPref, setPref } from './persist';
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
function pushRemote(userId: string, col: string, value: string, onResult: (ok: boolean) => void): void {
  const prev = pushTimers.get(col);
  if (prev) clearTimeout(prev);
  pushTimers.set(col, setTimeout(async () => {
    pushTimers.delete(col);
    // RLS restringe ao próprio id; valor vazio limpa a coluna (null).
    const res = await supabase?.from('account').update({ [col]: value || null }).eq('id', userId);
    onResult(!res?.error);
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
  // O write remoto é silencioso (debounce + fire-and-forget); sem este flag o menu
  // mostrava "Sincronizado" mesmo quando o UPDATE falhou e o valor só existia local.
  const [syncFailed, setSyncFailed] = useState(false);
  const onPush = useCallback((ok: boolean) => setSyncFailed(!ok), []);

  const setName = useCallback((v: string) => {
    setNameLocal(v);
    if (synced) pushRemote(userId!, 'display_name', v, onPush);
  }, [synced, userId, setNameLocal, onPush]);
  const setAvatar = useCallback((v: string) => {
    setAvatarLocal(v);
    if (synced) pushRemote(userId!, 'avatar_url', v, onPush);
  }, [synced, userId, setAvatarLocal, onPush]);
  const setAiIcon = useCallback((v: string) => {
    setAiIconLocal(v);
    if (synced) pushRemote(userId!, 'ai_avatar', v, onPush);
  }, [synced, userId, setAiIconLocal, onPush]);

  return { name, avatar, aiIcon, setName, setAvatar, setAiIcon, synced, syncFailed };
}

// Hidratação na conexão/login. Funde o perfil remoto da conta com o cache local.
// Regra por-COLUNA: o remoto vence QUANDO tem valor; um campo remoto nulo NUNCA
// apaga o local (senão um valor recém-setado some no refresh enquanto o write não
// pegou — era o bug). O que existe só no local sobe pro remoto (cura o write que
// falhou e a migração do perfil de loopback pra primeira conta). Troca de conta
// REAL (uid concreto → outro uid concreto) limpa o cache antes, pra não vazar o
// perfil da conta anterior; um blip transitório de uid→undefined (refresh de
// sessão) NÃO conta como troca e não zera nada.
export function useProfileHydration(userId: string | undefined): void {
  const prevUid = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!SUPABASE_ENABLED || !supabase) return;
    const uid = userId;
    const switched = prevUid.current != null && uid != null && uid !== prevUid.current;
    if (uid != null) prevUid.current = uid;
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

      const localName = loadPref<string>(NAME_KEY, '');
      const localAvatar = loadPref<string>(AVATAR_KEY, '');
      const localIcon = loadPref<string>(AI_AVATAR_KEY, AI_AVATAR_DEFAULT);

      const name = data.display_name ?? (localName || null);
      const avatar = data.avatar_url ?? (localAvatar || null);
      const icon = data.ai_avatar ?? (localIcon !== AI_AVATAR_DEFAULT ? localIcon : null);

      if (cancelled) return;
      setPref(NAME_KEY, name ?? '');
      setPref(AVATAR_KEY, avatar ?? '');
      setPref(AI_AVATAR_KEY, icon ?? AI_AVATAR_DEFAULT);

      // Cura o remoto quando ele estava sem algo que temos no local (write que
      // falhou antes, ou perfil de loopback subindo pra primeira conta). A troca de
      // conta já limpou o local acima, então isto só carrega valores DESTA conta.
      const remoteMissing =
        (data.display_name == null && name != null) ||
        (data.avatar_url == null && avatar != null) ||
        (data.ai_avatar == null && icon != null);
      if (remoteMissing) {
        await supabase!.from('account').update({
          display_name: name,
          avatar_url: avatar,
          ai_avatar: icon,
        }).eq('id', uid);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
}
