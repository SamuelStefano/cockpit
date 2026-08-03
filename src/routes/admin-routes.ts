import type { RouteView } from '../../shared/protocol';

export type RouteStatus = 'ativa' | 'cooldown' | 'sem credencial' | 'desligada' | 'pronta';

export function sortRoutes(routes: RouteView[]): RouteView[] {
  return [...routes].sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

// Precedência do rótulo: o que impede de usar AGORA vem antes do que é só config.
export function routeStatus(r: RouteView, now = Date.now()): RouteStatus {
  if (r.active) return 'ativa';
  if (!r.enabled) return 'desligada';
  if (!r.configured) return 'sem credencial';
  if (r.cooldownUntil > now) return 'cooldown';
  return 'pronta';
}

export function statusTone(s: RouteStatus): 'green' | 'yellow' | 'red' | 'neutral' {
  if (s === 'ativa') return 'green';
  if (s === 'pronta') return 'neutral';
  if (s === 'cooldown') return 'yellow';
  return 'red';
}

export function cooldownLabel(until: number, now = Date.now()): string | null {
  const ms = until - now;
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`;
}

export interface CustomDraft { id: string; baseUrl: string; model: string; authEnv: string }

// Espelho leve da validação do servidor (que é a autoritativa): serve pra não
// mandar lixo pelo WS e explicar o erro na hora, não pra ser a barreira real.
export function validateCustom(d: CustomDraft): string | null {
  const id = d.id.trim();
  if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(id)) return 'id: minúsculas, números e hífen (2-32)';
  if (!d.model.trim()) return 'informe o modelo';
  let u: URL;
  try { u = new URL(d.baseUrl.trim()); } catch { return 'URL inválida'; }
  if (u.protocol !== 'https:') return 'só https é aceito';
  if (u.username || u.password) return 'não coloque credencial na URL';
  if (d.authEnv.trim() && !/^[A-Z][A-Z0-9_]{1,63}$/.test(d.authEnv.trim())) return 'env: MAIÚSCULAS_COM_UNDERLINE';
  return null;
}
