import type { RouteView, RoutesSnapshot } from '../../shared/protocol';

export type RouteStatus = 'ativa' | 'cooldown' | 'sem credencial' | 'desligada' | 'pronta';

export function sortRoutes(routes: RouteView[]): RouteView[] {
  return [...routes].sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

// O veredito de elegibilidade é do servidor (`skip`), que é quem realmente escolhe
// a rota. Recalcular aqui a partir de enabled/configured/cooldown já divergiu uma
// vez: a UI dizia "pronta" para um provedor que o seletor pulava.
export function routeStatus(r: RouteView): RouteStatus {
  if (r.active) return 'ativa';
  switch (r.skip) {
    case 'disabled': return 'desligada';
    case 'no-credential': return 'sem credencial';
    case 'cooling': return 'cooldown';
    default: return 'pronta';
  }
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

// O toggle de cascata é por sessão (cada chat liga a sua) — não mora neste painel
// global. Isto só informa o que uma sessão que ligar vai encontrar: sem provedor
// barato elegível é um interruptor que a sessão liga sem efeito nenhum. O aviso
// mora aqui pra ficar testável fora do React.
export function cascadeHint(s: RoutesSnapshot | null): string {
  if (!s?.enabled) return 'Sem efeito: o roteamento está desligado.';
  const cheap = s.routes.find((r) => r.id === s.cascadeId);
  if (!cheap) return 'Sem efeito agora: nenhum provedor barato elegível (falta chave ou está em cooldown).';
  return `Sessões com cascata ligada tentam primeiro no ${cheap.label} e refazem no plano se não entregar.`;
}

export interface CustomDraft { id: string; baseUrl: string; model: string; authEnv: string }

// Espelho leve da validação do servidor (que é a autoritativa): serve pra não
// mandar lixo pelo WS e explicar o erro na hora, não pra ser a barreira real.
export function validateCustom(d: CustomDraft): string | null {
  const id = d.id.trim();
  // Mesmo recorte do servidor (catalog.ts): começar por letra. Divergir aqui só
  // faria a UI aceitar um id que o WS devolve com erro.
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(id)) return 'id: começa com letra; minúsculas, números e hífen (2-32)';
  if (!d.model.trim()) return 'informe o modelo';
  let u: URL;
  try { u = new URL(d.baseUrl.trim()); } catch { return 'URL inválida'; }
  if (u.protocol !== 'https:') return 'só https é aceito';
  if (u.username || u.password) return 'não coloque credencial na URL';
  if (d.authEnv.trim() && !/^[A-Z][A-Z0-9_]{1,63}$/.test(d.authEnv.trim())) return 'env: MAIÚSCULAS_COM_UNDERLINE';
  return null;
}
