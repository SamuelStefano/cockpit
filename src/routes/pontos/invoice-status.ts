type Tone = 'green' | 'orange' | 'red' | 'neutral';

// DFL invoice statuses, as the payments flow uses them. The raw English value
// showed on /pontos; "submitted" read as done when it means "awaiting review".
const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: 'rascunho', tone: 'neutral' },
  submitted: { label: 'em revisão', tone: 'orange' },
  approved: { label: 'aprovada', tone: 'orange' },
  payment_requested: { label: 'cobrança pedida', tone: 'orange' },
  pending: { label: 'em aberto', tone: 'orange' },
  open: { label: 'em aberto', tone: 'orange' },
  paid: { label: 'paga', tone: 'green' },
  rejected: { label: 'rejeitada', tone: 'red' },
  cancelled: { label: 'cancelada', tone: 'neutral' },
};

export function invoiceStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: status, tone: 'neutral' };
}
