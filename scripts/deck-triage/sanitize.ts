import type { DiagReport } from '../../ops/src/data.ts';

const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏  ‪-‮⁦-⁩﻿]/g;

// Single line, no control/bidi/zero-width bytes, no angle brackets (so text cannot
// close or forge the wrapper tags of the prompt), capped.
export function cleanText(v: unknown, max = 200): string {
  const s = String(v ?? '').replace(CONTROL, ' ').replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›')).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const KIND = /^[a-z][a-z0-9_-]{0,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface SafeReport { created_at: string; source: string; kind: string; box: string | null; app_version: string; payload: string }

export function sanitizeReport(r: DiagReport, payloadMax = 1500): SafeReport {
  let payload: string;
  try { payload = JSON.stringify(r.payload) ?? ''; } catch { payload = ''; }
  const t = new Date(r.created_at);
  return {
    created_at: Number.isNaN(t.getTime()) ? '?' : t.toISOString(),
    source: KIND.test(r.source) ? r.source : '?',
    kind: KIND.test(r.kind) ? r.kind : '?',
    box: r.box_id && UUID.test(r.box_id) ? r.box_id : null,
    app_version: cleanText(r.app_version, 80),
    payload: cleanText(payload, payloadMax),
  };
}

export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID.test(s);
export const isKind = (s: unknown): s is string => typeof s === 'string' && KIND.test(s);
