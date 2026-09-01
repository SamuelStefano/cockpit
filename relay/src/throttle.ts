// Limitador de janela deslizante em memória. O relay é um processo só (loopback
// atrás do Caddy), então não há estado a compartilhar entre réplicas.

const SWEEP_AT = 1000;

export type Throttle = (key: string, now?: number) => boolean;

export function slidingWindow(limit: number, windowMs: number): Throttle {
  const hits = new Map<string, number[]>();
  return (key, now = Date.now()) => {
    const fresh = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    // Sem varredura o Map cresce por conta que já passou por aqui e nunca volta.
    // Amortizado: só varre quando o mapa já ficou grande.
    if (hits.size > SWEEP_AT) {
      for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
    if (fresh.length >= limit) { hits.set(key, fresh); return false; }
    fresh.push(now);
    hits.set(key, fresh);
    return true;
  };
}
