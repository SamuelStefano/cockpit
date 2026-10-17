// Database-derived names are attacker-controlled (anyone able to CREATE can name a schema
// after prompt-injection text or terminal escapes). Everything from the database goes
// through here before it reaches a card, the jsonl, or stdout.

const CONTROL = /[\x00-\x1f\x7f-\x9f]/g;
const INVISIBLE = new RegExp('[\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2069\\ufeff]', 'g');

export function sanitizeText(input: unknown, max: number): string {
  let s = String(input ?? '');
  s = s.replace(/[\t\n\r]/g, ' ').replace(CONTROL, '').replace(INVISIBLE, ' ');
  s = s.replace(/[<>]/g, '').replace(/alert-data/gi, 'alert_data');
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function sanitizeIdent(input: unknown): string {
  return sanitizeText(input, 80);
}
