import type { BotView } from '../../../routes/equipe/team-view';

export function pendingRequests(views: BotView[]): number {
  return views.filter((v) => !!v.pending || v.state === 'waiting').length;
}

export function requestsLabel(n: number): string {
  return `${n} ${n === 1 ? 'pedido esperando' : 'pedidos esperando'} você`;
}
