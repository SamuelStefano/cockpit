// Multi-box: one account, several paired machines ("boxes"). A box is a paired
// agent; its id is the relay's agent id. The relay owns this metadata and sends
// it to the account's tabs as a `boxes` frame; boxes themselves never see it.

export interface BoxInfo {
  id: string;
  label: string;
  online: boolean;
  lastSeen: string | null;
}

export interface BoxesFrame {
  t: 'boxes';
  // The box this tab asked for (`?box=`), null when it follows the primary.
  box: string | null;
  // The box an unbound tab talks to: the earliest-bound one online.
  primary: string | null;
  boxes: BoxInfo[];
}

export const BOX_LABEL_MAX = 64;
const BOX_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBoxId(s: unknown): s is string {
  return typeof s === 'string' && BOX_ID.test(s);
}

// Control characters would reach a terminal or a log; bidi overrides let one box
// render as another's name.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

export function sanitizeBoxLabel(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const clean = raw.normalize('NFKC').replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
  return [...clean].slice(0, BOX_LABEL_MAX).join('').trim();
}
