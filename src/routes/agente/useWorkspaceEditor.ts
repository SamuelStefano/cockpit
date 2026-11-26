import { useEffect, useRef, useState } from 'react';
import { botFileKey } from '../../cockpit/useBotFiles';
import { toast } from '../../components/primitives';
import type { BotFilesApi } from '../equipe/equipe-props';
import { saveErrorCopy } from './workspace-edit';

interface Draft { path: string; base: string; text: string; baseMtime?: number }

export function useWorkspaceEditor(botId: string, api: BotFilesApi, openText: string | undefined) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  useEffect(() => { setDraft(null); setError(null); pending.current = null; }, [botId]);

  const saveState = draft ? api.botFileSaves?.[botFileKey(botId, draft.path)] : undefined;
  useEffect(() => {
    if (!saveState || !pending.current || saveState.status === 'saving') return;
    pending.current = null;
    if (saveState.status === 'saved') { setDraft(null); setError(null); toast('Arquivo salvo'); }
    else setError(saveErrorCopy(saveState.error));
  }, [saveState]);

  const mtimeOf = (path: string) => api.botFiles[botId]?.find((f) => f.path === path)?.mtime;
  return {
    draft,
    error,
    saving: saveState?.status === 'saving' && pending.current !== null,
    dirty: !!draft && draft.text !== draft.base,
    canEdit: !!api.onBotFilePut,
    start: (path: string) => { setError(null); setDraft({ path, base: openText ?? '', text: openText ?? '', baseMtime: mtimeOf(path) }); },
    startNew: (path: string) => { setError(null); setDraft({ path, base: '', text: '' }); },
    change: (text: string) => setDraft((d) => (d ? { ...d, text } : d)),
    cancel: () => { setDraft(null); setError(null); pending.current = null; },
    save: () => {
      if (!draft || !api.onBotFilePut) return;
      setError(null);
      if (api.onBotFilePut(botId, draft.path, draft.text, draft.baseMtime)) pending.current = draft.path;
      else setError('Sem conexão. Tente de novo.');
    },
  };
}
