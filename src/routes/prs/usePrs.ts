import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PrSummary } from '../../../shared/prs';
import { getPrsState, requestPrDetail, requestPrs, subscribePrs } from './prs-bus';
import { filterPrs, groupByOrg, groupMergedByDay, type PrFilter } from './prs-view';

export type PrTab = 'mine' | 'review' | 'merged';

const POLL_MS = 120_000;

export function usePrs(connected: boolean) {
  const state = useSyncExternalStore(subscribePrs, getPrsState, getPrsState);
  const [tab, setTab] = useState<PrTab>('mine');
  const [filter, setFilter] = useState<PrFilter>({ org: null, repo: null });
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    requestPrs();
    const id = setInterval(() => requestPrs(), POLL_MS);
    return () => clearInterval(id);
  }, [connected]);

  useEffect(() => {
    if (connected && selectedUrl) requestPrDetail(selectedUrl);
  }, [connected, selectedUrl]);

  const { snapshot } = state;
  const tabList: PrSummary[] = useMemo(() => snapshot?.[tab] ?? [], [snapshot, tab]);
  const orgs = useMemo(() => groupByOrg(tabList), [tabList]);
  const visible = useMemo(() => filterPrs(tabList, filter), [tabList, filter]);
  const days = useMemo(() => (tab === 'merged' ? groupMergedByDay(visible) : []), [tab, visible]);
  const selected = useMemo(() => {
    if (!selectedUrl || !snapshot) return null;
    return [...snapshot.mine, ...snapshot.review, ...snapshot.merged].find((p) => p.url === selectedUrl) ?? null;
  }, [snapshot, selectedUrl]);

  const changeTab = useCallback((t: PrTab) => {
    setTab(t);
    setFilter({ org: null, repo: null });
    setSelectedUrl(null);
  }, []);
  const refresh = useCallback(() => { requestPrs(true); }, []);
  const retryDetail = useCallback(() => { if (selectedUrl) requestPrDetail(selectedUrl); }, [selectedUrl]);

  return {
    snapshot, loading: state.loading, tab, changeTab, filter, setFilter, orgs, visible, days,
    total: tabList.length, selected, selectedUrl, select: setSelectedUrl,
    detail: selectedUrl ? state.details[selectedUrl] : undefined, refresh, retryDetail,
  };
}
