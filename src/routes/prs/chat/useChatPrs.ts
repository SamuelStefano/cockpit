import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PrSummary } from '../../../../shared/prs';
import { getPrsState, requestPrDetail, requestSessionPrs, subscribePrs } from '../prs-bus';
import { groupByRepo } from '../prs-view';

const WIDE = '(min-width: 1024px)';

// `markers`: how many PR dividers the thread shows; a new one means the chat just
// opened a PR, so the count on the button is asked again.
export function useChatPrs(sessionId: string, markers: number, connected: boolean) {
  const state = useSyncExternalStore(subscribePrs, getPrsState, getPrsState);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const entry = state.sessions[sessionId];
  const session = entry?.session ?? null;

  // `connected` in the deps: a header that mounted before the socket opened asks again.
  useEffect(() => { if (connected) requestSessionPrs(sessionId, false); }, [sessionId, markers, connected]);
  useEffect(() => { if (open && connected) requestSessionPrs(sessionId, true); }, [open, sessionId, markers, connected]);

  const prs: PrSummary[] = useMemo(() => session?.prs ?? [], [session]);
  const created = useMemo(() => new Set(session?.createdUrls ?? []), [session]);
  const groups = useMemo(() => groupByRepo(prs), [prs]);
  // Side by side there is room for the code at once; on a phone the list comes first.
  const fallback = open && !picked && typeof window !== 'undefined' && window.matchMedia?.(WIDE).matches ? groups[0]?.prs[0]?.url ?? null : null;
  const selectedUrl = picked ?? fallback;
  const selected = prs.find((p) => p.url === selectedUrl) ?? null;

  useEffect(() => { if (open && connected && selectedUrl) requestPrDetail(selectedUrl); }, [open, connected, selectedUrl]);

  const retryDetail = useCallback(() => { if (selectedUrl) requestPrDetail(selectedUrl); }, [selectedUrl]);
  const refresh = useCallback(() => { requestSessionPrs(sessionId, true); }, [sessionId]);

  return {
    open, setOpen, groups, created, selected, selectedUrl, select: setPicked,
    count: session ? session.createdUrls.length + session.mentionedUrls.length : 0,
    createdCount: session?.createdUrls.length ?? 0,
    loading: !session?.prs && !session?.error && (entry?.hydrating ?? true), refreshing: !!entry?.hydrating, error: session?.error,
    detail: selectedUrl ? state.details[selectedUrl] : undefined, retryDetail, refresh,
  };
}
