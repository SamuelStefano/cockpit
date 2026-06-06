// Último rate-limit conhecido: o CLI só emite `rate_limit_event` durante um run,
// então uma aba recém-aberta (ou pós-reconnect) ficaria sem o chip de reset até
// o próximo run. Cacheia e replaya no connect — o Samuel quer o reset SEMPRE à vista.
let lastRate: { resetsAt: number; status: string } | null = null;

export function getLastRate() { return lastRate; }
export function setLastRate(r: { resetsAt: number; status: string }) { lastRate = r; }
