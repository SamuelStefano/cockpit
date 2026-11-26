import { useEffect, useRef, useState } from 'react';
import { botFileKey } from '../../cockpit/useBotFiles';
import { toast } from '../../components/primitives';
import type { BotFilesApi } from '../equipe/equipe-props';
import { saveErrorCopy } from './workspace-edit';

interface Draft { path: string; base: string; text: string; baseMtime?: number }
interface OpenFile { text?: string; mtime?: number }

const isDirty = (d: Draft | null) => !!d && d.text !== d.base;

// Unsaved text outlives the tab: switching agent tab, agent or route unmounts the
// editor, and coming back finds the draft where it was.
export const draftStash = new Map<string, Draft>();

export function useWorkspaceEditor(botId: string, api: BotFilesApi, open: OpenFile) {
  const [draft, setDraftState] = useState<Draft | null>(() => draftStash.get(botId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const seenBot = useRef(botId);
  useEffect(() => {
    if (seenBot.current === botId) return;
    seenBot.current = botId;
    setDraftState(draftStash.get(botId) ?? null); setError(null); pending.current = null;
  }, [botId]);

  const setDraft = (d: Draft | null) => {
    if (isDirty(d)) draftStash.set(botId, d!); else draftStash.delete(botId);
    setDraftState(d);
  };

  const saveState = draft ? api.botFileSaves?.[botFileKey(botId, draft.path)] : undefined;
  useEffect(() => {
    if (!saveState || !pending.current || saveState.status === 'saving') return;
    pending.current = null;
    if (saveState.status === 'saved') { draftStash.delete(botId); setDraftState(null); setError(null); toast('Arquivo salvo'); }
    else setError(saveErrorCopy(saveState.error));
  }, [saveState, botId]);

  const dirty = isDirty(draft);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return {
    draft,
    error,
    saving: saveState?.status === 'saving' && pending.current !== null,
    dirty,
    canEdit: !!api.onBotFilePut,
    // The base mtime is the one that came WITH the text being edited: the listing
    // refreshes on its own and would vouch for content the editor never saw.
    start: (path: string) => { setError(null); setDraft({ path, base: open.text ?? '', text: open.text ?? '', baseMtime: open.mtime }); },
    // 0 = "must not exist yet": a file the bot created meanwhile is a conflict.
    startNew: (path: string) => { setError(null); setDraft({ path, base: '', text: '', baseMtime: 0 }); },
    change: (text: string) => { if (draft) setDraft({ ...draft, text }); },
    cancel: () => { setDraft(null); setError(null); pending.current = null; },
    save: () => {
      if (!draft || !api.onBotFilePut) return;
      setError(null);
      if (api.onBotFilePut(botId, draft.path, draft.text, draft.baseMtime)) pending.current = draft.path;
      else setError('Sem conexão. Tente de novo.');
    },
  };
}
