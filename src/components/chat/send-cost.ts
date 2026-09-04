import { estimateSendCost, fitsInWindow, costLabel, type SendCost } from '../../../shared/send-cost';
import type { PlanUsage } from '../../../shared/protocol';

// Custo do PRÓXIMO envio, mostrado acima do compositor.
//
// O SaturationBanner já diz "sessão lotada" a partir de 80% da janela do CLI. Ele
// não sabe do preço: uma sessão de 690k com o cache QUENTE custa ~1% da janela de
// 5h, e a MESMA sessão com o cache frio custa ~13%. Em 04/09/2026 foi essa
// diferença que levou a cota de 20% a 100% em 3min29s — o Samuel não tinha como
// ver, porque a informação não existia em lugar nenhum da tela.

// Abaixo disto o aviso seria ruído: quase todo envio de sessão viva cai aqui.
export const NOTICE_PCT = 5;
// Acima disto o envio pede confirmação — um clique distraído custa caro demais.
export const CONFIRM_PCT = 10;

export interface ComposerCost {
  cost: SendCost;
  label: string;
  notice: boolean;
  confirm: boolean;
  fits: boolean;
}

// `lastUsageAt` = quando o último frame de usage chegou pra esta sessão. É o
// proxy da temperatura do cache que o cliente tem — o servidor decide pelo `ts`
// da amostra no SQLite, e os dois convergem porque é o mesmo evento.
export function composerCost(a: {
  ctxTokens: number;
  lastUsageAt?: number;
  planUsage: PlanUsage | null;
  now: number;
}): ComposerCost | null {
  if (!a.ctxTokens || a.ctxTokens <= 0) return null;
  const cost = estimateSendCost({ ctxTokens: a.ctxTokens, ts: a.lastUsageAt ?? 0, model: null }, a.now);
  const fits = fitsInWindow(cost, a.planUsage?.fiveHour ?? null);
  const notice = cost.pctOfWindow >= NOTICE_PCT || !fits;
  if (!notice) return null;
  return { cost, label: costLabel(cost), notice, confirm: cost.pctOfWindow >= CONFIRM_PCT || !fits, fits };
}
