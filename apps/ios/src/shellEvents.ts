/**
 * Native -> web events. The shell injects a script that dispatches `CustomEvent('deck-shell')` on
 * `window`; the web listens (src/lib/shell.ts). Pure TypeScript.
 *
 *   { type: 'screenshots-status', status: 'granted' | 'limited' | 'denied' | 'undetermined' }
 *   { type: 'screenshot-available', id, thumbnail }   thumbnail is a small JPEG data URL
 *   { type: 'screenshot-data', id, dataUrl }          the resized JPEG, only after screenshot-accept
 */
import type { AccessStatus } from './screenshotOffer';

export type ShellEvent =
  | { type: 'screenshots-status'; status: AccessStatus }
  | { type: 'screenshot-available'; id: string; thumbnail: string }
  | { type: 'screenshot-data'; id: string; dataUrl: string };

/** The `injectJavaScript` source for one event. The payload travels as a JSON string literal parsed in the page. */
export function buildEventScript(event: ShellEvent): string {
  // JSON.stringify of a string is a valid JS string literal; U+2028/2029 are escaped for older engines.
  const literal = JSON.stringify(JSON.stringify(event)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `(function(){try{window.dispatchEvent(new CustomEvent('deck-shell',{detail:JSON.parse(${literal})}));}catch(e){}})();true;`;
}
