// Tempo até o reset do limite de uso, em rótulo curto ("agora"/"42min"/"3h05"/"2d14h").
export function relReset(resetsAt: number, now: number = Date.now()): string {
  const diff = resetsAt - now;
  if (diff <= 0) return 'agora';
  // max(1): sem o clamp, diff < 30s arredondaria pra "0min".
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  // A janela semanal chega a 168h — "168h00" não se lê.
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`;
  return `${h}h${String(min % 60).padStart(2, '0')}`;
}

// Idade de uma leitura, em rótulo curto ("agora"/"12min"/"1h05"/"2d"). É o espelho
// do relReset pro passado: a barra de uso precisa dizer QUANDO leu o número.
export function relAge(at: number, now: number = Date.now()): string {
  const min = Math.round(Math.max(0, now - at) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  return `${h}h${String(min % 60).padStart(2, '0')}`;
}
