const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"'`]/g, (c) => ENTITIES[c]);
}

// Tagged template that escapes every interpolation unless it is already Html.
export class Html {
  readonly value: string;
  constructor(value: string) { this.value = value; }
  toString(): string { return this.value; }
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += fragment(values[i]) + strings[i + 1];
  return new Html(out);
}

function fragment(v: unknown): string {
  if (v instanceof Html) return v.value;
  if (Array.isArray(v)) return v.map(fragment).join('');
  return esc(v);
}

// Only same-app paths, so a crafted value can never turn into javascript: or an off-site link.
export function href(path: string, params: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return path.startsWith('/') && !path.startsWith('//') ? `${path}${qs ? `?${qs}` : ''}` : '/';
}
