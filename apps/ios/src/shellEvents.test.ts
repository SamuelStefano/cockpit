import { describe, expect, it } from 'vitest';
import { buildEventScript } from './shellEvents';

function run(script: string): unknown {
  let detail: unknown;
  const window = { dispatchEvent: (e: { detail: unknown }) => { detail = e.detail; } };
  class CustomEvent { constructor(public type: string, public init: { detail: unknown }) {} get detail() { return this.init.detail; } }
  new Function('window', 'CustomEvent', script)(window, CustomEvent);
  return detail;
}

describe('buildEventScript', () => {
  it('round-trips a payload through the page', () => {
    const ev = { type: 'screenshot-data' as const, id: 'A/L0/001', dataUrl: 'data:image/jpeg;base64,/9j/AAAA==' };
    expect(run(buildEventScript(ev))).toEqual(ev);
  });
  it('cannot be broken out of by quotes, newlines or line separators in a value', () => {
    const nasty = `'"\\\n\r\u2028\u2029</script>');alert(1);//`;
    const ev = { type: 'screenshot-available' as const, id: nasty, thumbnail: nasty };
    const script = buildEventScript(ev);
    for (const ch of ['\u2028', '\u2029', '\n', '\r']) expect(script.includes(ch)).toBe(false);
    expect(run(script)).toEqual(ev);
  });
  it('ends with true so injectJavaScript does not warn', () => {
    expect(buildEventScript({ type: 'screenshots-status', status: 'limited' }).endsWith('true;')).toBe(true);
  });
});
