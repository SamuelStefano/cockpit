// Tempo até o reset do limite de uso, em rótulo curto ("agora"/"42min"/"3h05").
export function relReset(resetsAt: number, now: number = Date.now()): string {
  const diff = resetsAt - now;
  if (diff <= 0) return 'agora';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}
