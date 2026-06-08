// Último rate-limit conhecido: o CLI só emite `rate_limit_event` durante um run,
// então uma aba recém-aberta (ou pós-reconnect) ficaria sem o chip de reset até
// o próximo run. Cacheia e replaya no connect — o Samuel quer o reset SEMPRE à vista.
let lastRate: { resetsAt: number; status: string } | null = null;

// Replay no connect, MAS não serve uma janela já expirada: depois de resetsAt o
// chip mostraria um reset velho como se fosse atual. Descarta ao ler se passou.
export function getLastRate() {
  if (lastRate && lastRate.resetsAt > 0 && lastRate.resetsAt < Date.now()) lastRate = null;
  return lastRate;
}
export function setLastRate(r: { resetsAt: number; status: string }) {
  lastRate = { resetsAt: r.resetsAt, status: typeof r.status === 'string' ? r.status : 'allowed' };
}
