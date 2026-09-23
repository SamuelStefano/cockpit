// Centavos → "R$ 1.234,56" (pt-BR). Determinístico, sem dependência de locale.
export function brl(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100);
  const c = String(abs % 100).padStart(2, '0');
  const s = reais.toLocaleString('pt-BR');
  return `${neg ? '-' : ''}R$ ${s},${c}`;
}

// Pontos × valor do ponto (R$) → centavos. Base do recebível recalculável quando
// o usuário troca o valor do ponto na UI.
export function centsFromPoints(points: number, pointValue: number): number {
  return Math.round(points * pointValue * 100);
}

// Pontos com no máx. 1 casa, vírgula pt-BR: 491.38 → "491,4"; 20 → "20".
export function fmtPts(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}

// "2026-07" → "jul/26". Mês inválido cai no texto cru.
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function refMonth(ref: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ref);
  if (!m) return ref;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${mes}/${m[1].slice(2)}` : ref;
}

// What a person types for R$: "75", "75,50", "4.000", "R$ 4.000,00". A dot followed
// by exactly three digits is a thousands separator, anything else is a decimal.
export function parseBrl(v: string): number {
  const clean = v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  return clean ? Number(clean) : Number.NaN;
}

export function validBrl(v: string): boolean {
  const n = parseBrl(v);
  return Number.isFinite(n) && n > 0;
}

// Dense columns (navigator, KPI strip): whole reais, no cents — "R$ 1.800".
export function brlShort(cents: number): string {
  return cents < 0 ? `-R$ ${reaisInt(-cents)}` : `R$ ${reaisInt(cents)}`;
}

// A column already headed "R$" does not repeat the symbol on every line: "1.800".
export function reaisInt(cents: number): string {
  return Math.round(cents / 100).toLocaleString('pt-BR');
}
