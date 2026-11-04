/**
 * The chrome of the shell is one pure reducer: only the states that exist before the web document
 * does (loading veil, load failure, offline card, process death). Retry and process death REMOUNT the
 * WebView by React `key`; they never call `reload()`. After three process deaths in a row the card appears.
 *
 * Pure TypeScript: no React Native import.
 */
export type Phase = 'loading' | 'ready' | 'failed';

export interface ChromeState {
  phase: Phase;
  /** Bumped on retry and process death: the WebView `key`. */
  attempt: number;
  /** Process deaths since the last successful load. */
  deaths: number;
  reason?: 'error' | 'http' | 'timeout' | 'process';
}

export type ChromeEvent =
  | { type: 'loadStart' }
  | { type: 'loadEnd' }
  | { type: 'error' }
  | { type: 'httpError'; status: number; mainFrame: boolean }
  | { type: 'timeout' }
  | { type: 'retry' }
  | { type: 'processGone' };

export const LOAD_TIMEOUT_MS = 15_000;
export const MAX_DEATHS = 3;

export const initialChrome: ChromeState = { phase: 'loading', attempt: 0, deaths: 0 };

export function chromeReducer(state: ChromeState, event: ChromeEvent): ChromeState {
  switch (event.type) {
    case 'loadStart':
      // A new load while failed keeps the card: only retry leaves it.
      return state.phase === 'failed' ? state : { ...state, phase: 'loading' };
    case 'loadEnd':
      // A loadEnd after a timeout returns to ready; after an error it stays failed.
      return state.phase === 'failed' && state.reason !== 'timeout' ? state : { ...state, phase: 'ready', deaths: 0, reason: undefined };
    case 'error':
      return { ...state, phase: 'failed', reason: 'error' };
    case 'httpError':
      return event.mainFrame && event.status >= 400 ? { ...state, phase: 'failed', reason: 'http' } : state;
    case 'timeout':
      return state.phase === 'loading' ? { ...state, phase: 'failed', reason: 'timeout' } : state;
    case 'retry':
      return { phase: 'loading', attempt: state.attempt + 1, deaths: 0 };
    case 'processGone': {
      const deaths = state.deaths + 1;
      return deaths >= MAX_DEATHS
        ? { ...state, phase: 'failed', deaths, reason: 'process' }
        : { phase: 'loading', attempt: state.attempt + 1, deaths };
    }
  }
}

/** Hardware/gesture back is the WebView's while it can go back and the card is not up. */
export const webViewHandlesBack = (state: ChromeState, canGoBack: boolean): boolean => canGoBack && state.phase !== 'failed';
