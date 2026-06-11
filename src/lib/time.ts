// Tempo até o reset do limite de uso, em rótulo curto ("agora"/"42min"/"3h05").
export function relReset(resetsAt: number, now: number = Date.now()): string {
  const diff = resetsAt - now;
  if (diff <= 0) return 'agora';
  // max(1): sem o clamp, diff < 30s arredondaria pra "0min".
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

// Tempo decorrido desde um instante passado, rótulo curto ("agora"/"3h"/"2d"/"5sem").
export function relPast(then: number, now: number = Date.now()): string {
  const min = Math.round((now - then) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}sem`;
}
