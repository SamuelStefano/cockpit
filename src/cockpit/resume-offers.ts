import type { ResumeOfferReason } from '../../shared/protocol';

// Oferta de retomada da sessão: o turno morreu, o servidor decidiu não retomar
// sozinho e guardou a config. A UI mostra o motivo e um botão; o clique manda
// `resume-run`, que vale um `--resume` de verdade.
export interface ResumeOfferView { sessionKey: string; reason: ResumeOfferReason; message: string }
export type ResumeOffers = Record<string, ResumeOfferView>;

export function addOffer(offers: ResumeOffers, key: string, reason: ResumeOfferReason, message: string): ResumeOffers {
  return { ...offers, [key]: { sessionKey: key, reason, message } };
}

// Identidade quando não há oferta: o setState não re-renderiza a árvore do chat
// a cada 'started' de qualquer sessão.
export function clearOffer(offers: ResumeOffers, key: string): ResumeOffers {
  if (!offers[key]) return offers;
  const next = { ...offers };
  delete next[key];
  return next;
}
