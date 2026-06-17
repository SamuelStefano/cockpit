// Ticker AO VIVO de tokens do turno: nunca regride DENTRO de um turno. É o maior
// entre a estimativa por chars de saída (preenche o intervalo entre chamadas API)
// e o piso REAL (turnTokens SEM cache read, reportado pelo server a cada chamada).
// Sem o max, a estimativa por chars (centenas) arrastaria o número real (milhares)
// pra baixo a cada delta. O reset pra novo turno é feito zerando ambos na origem.
export function liveTokens(charEstimate: number, realFloor: number): number {
  return Math.max(charEstimate, realFloor);
}
