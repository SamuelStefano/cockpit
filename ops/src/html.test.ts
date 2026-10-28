import { describe, expect, it } from 'vitest';
import type { DiagReport } from './data.ts';
import { esc, href, html } from './html.ts';
import { boxesPage, reportPage, reportsPage } from './views.ts';

const XSS = `"><script>alert(1)</script><img src=x onerror=alert(2)>'\``;
const health = { ok: true, text: 'relay ok' };

const hostile: DiagReport = {
  id: '11111111-1111-1111-1111-111111111111',
  created_at: '2026-10-28T12:00:00.000Z',
  account_id: '22222222-2222-2222-2222-222222222222',
  source: 'browser',
  kind: 'js-error',
  box_id: '33333333-3333-3333-3333-333333333333',
  app_version: XSS,
  user_agent: XSS,
  payload: { cause: XSS, extra: { message: XSS }, events: [{ at: XSS, ev: XSS, [XSS]: XSS }], lines: [XSS] },
};

function assertInert(page: string) {
  expect(page).not.toContain('<script');
  expect(page).not.toContain('<img');
  expect(page).not.toMatch(/"\s*onerror=/);
  expect(page).toContain('&lt;script&gt;');
}

describe('html escaping', () => {
  it('escapes every special character', () => {
    expect(esc(`<a href="x">'&\``)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#96;');
    expect(html`<p>${XSS}</p>`.value).not.toContain('<script');
  });

  it('keeps href on same-app paths', () => {
    expect(href('javascript:alert(1)')).toBe('/');
    expect(href('//evil.com')).toBe('/');
    expect(href('/reports', { box: '"><x' })).toBe('/reports?box=%22%3E%3Cx');
  });

  it('renders hostile reports inert on the list and detail pages', () => {
    const emails = new Map([[hostile.account_id, XSS]]);
    const labels = new Map([[hostile.box_id as string, XSS]]);
    assertInert(reportsPage({ rows: [hostile], emails, labels, filters: { email: XSS, kind: XSS, box: XSS }, now: Date.now(), health }));
    assertInert(reportPage(hostile, XSS, XSS, Date.now(), { ok: false, text: XSS }));
  });

  it('renders hostile box labels inert', () => {
    const page = boxesPage([{ id: 'x', account_id: 'y', kind: 'vps', label: XSS, paired_at: XSS, last_seen: null, revoked_at: null }], new Map([['y', XSS]]), Date.now(), health);
    assertInert(page);
  });
});
