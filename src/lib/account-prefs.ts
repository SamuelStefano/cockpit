import { loadPref, setPref, removePref, hasPref, subscribePref } from './persist';
import {
  SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT,
  GROUP_NOTES_KEY, GROUP_NOTES_DEFAULT,
  SHOW_SESSION_DESC_KEY, SHOW_SESSION_DESC_DEFAULT,
} from './prefs';

// Prefs que pertencem à CONTA, não ao aparelho: modo de permissão, modelo, esforço
// e os toggles de UI. Sem isto o celular e o PC do mesmo dono divergiam — trocar
// pra Opus no PC não valia no celular. Viajam juntas na coluna `account.prefs`
// (jsonb), sob a mesma RLS self-update do perfil.
//
// WHY do que fica de FORA: `drafts`, `auth.token`, `ws.url`, `activeId`, `seen` e
// `pendingAtts:*` são estado de APARELHO — rascunho a meio caminho, token/URL da
// box pareada, aba aberta, o que ESTE device já viu, anexo ainda não enviado.
// Sincronizar isso faria um device apagar o rascunho do outro, e o token de
// pareamento não deve nem sair deste navegador.

export const MODE_KEY = 'mode';
export const MODEL_KEY = 'model';
export const EFFORT_KEY = 'effort';
export const CUSTOM_MODELS_KEY = 'customModels';

export const ACCOUNT_PREF_KEYS = [
  MODE_KEY, MODEL_KEY, EFFORT_KEY,
  SHOW_TOOLS_KEY, GROUP_NOTES_KEY, SHOW_SESSION_DESC_KEY,
  CUSTOM_MODELS_KEY,
] as const;

export type AccountPrefKey = (typeof ACCOUNT_PREF_KEYS)[number];
export type AccountPrefs = Partial<Record<AccountPrefKey, unknown>>;

// Mesmos defaults dos donos de cada key — usados só pra repintar a UI na troca de
// conta (o valor real vem da hidratação em seguida).
const DEFAULTS: Record<AccountPrefKey, unknown> = {
  [MODE_KEY]: 'auto',
  [MODEL_KEY]: 'sonnet',
  [EFFORT_KEY]: 'low',
  [SHOW_TOOLS_KEY]: SHOW_TOOLS_DEFAULT,
  [GROUP_NOTES_KEY]: GROUP_NOTES_DEFAULT,
  [SHOW_SESSION_DESC_KEY]: SHOW_SESSION_DESC_DEFAULT,
  [CUSTOM_MODELS_KEY]: [],
};

// Só o que EXISTE no localStorage: um aparelho recém-aberto não tem opinião, e
// semear o default dele por cima da conta seria justamente o bug de "o celular
// sobrescreve o que escolhi no PC".
export function readLocalAccountPrefs(): AccountPrefs {
  const out: AccountPrefs = {};
  for (const key of ACCOUNT_PREF_KEYS) if (hasPref(key)) out[key] = loadPref<unknown>(key, DEFAULTS[key]);
  return out;
}

// Merge LWW por CHAVE, igual ao resolvePref das outras colunas: a chave presente
// no remoto vence (a escolha feita no outro device propaga); a que só existe local
// vai pro remoto (`seed`) — conta antiga com a coluna nula, ou write que falhou.
// Chave desconhecida no jsonb é ignorada: a conta é escrita pelo próprio cliente
// sob RLS, e nada além destas keys pode voltar a mexer no localStorage.
export function mergeAccountPrefs(remote: AccountPrefs | null, local: AccountPrefs): { value: AccountPrefs; seed: boolean } {
  const value: AccountPrefs = {};
  let seed = false;
  for (const key of ACCOUNT_PREF_KEYS) {
    const fromRemote = remote?.[key];
    if (fromRemote !== undefined && fromRemote !== null) { value[key] = fromRemote; continue; }
    if (key in local) { value[key] = local[key]; seed = true; }
  }
  return { value, seed };
}

// setPref (e não savePref) porque a UI já está montada: os hooks usePersisted e os
// usePrefListener do useCockpit precisam ouvir a hidratação pra repintar.
export function applyAccountPrefs(prefs: AccountPrefs): void {
  for (const key of ACCOUNT_PREF_KEYS) if (key in prefs) setPref(key, prefs[key]);
}

// Troca de conta: pref da conta anterior não pode sobrar no aparelho. Repinta no
// default (setPref avisa a UI) e APAGA a key — se ficasse gravada, este device
// semearia o default como se fosse escolha do novo dono.
export function clearAccountPrefs(): void {
  for (const key of ACCOUNT_PREF_KEYS) {
    setPref(key, DEFAULTS[key]);
    removePref(key);
  }
}

export function subscribeAccountPrefs(onChange: () => void): () => void {
  const offs = ACCOUNT_PREF_KEYS.map((key) => subscribePref(key, onChange));
  return () => { for (const off of offs) off(); };
}
