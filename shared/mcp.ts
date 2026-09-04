// Sentinel de "permitir todos os MCPs" no campo `mcps` do frame de envio. Mora no
// shared porque o cliente é quem manda e o servidor é quem expande (runs.ts).
export const ALL_MCPS = '*';

export function isAllMcps(selected: string[]): boolean {
  return selected.includes(ALL_MCPS);
}
