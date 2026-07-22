// Sessões cujo último turno terminou em AskUserQuestion e aguardam a RESPOSTA do
// usuário. Vive fora de runs.ts/translate.ts pra evitar import circular (runs →
// translate → runs). O latch sobrevive ao fim do thread (threads.delete) — é ele
// que deixa o startRun estacionar um flush automático de fila que chegaria antes
// da resposta e roubaria o card de escolha.
export const awaitingAnswer = new Set<string>();
