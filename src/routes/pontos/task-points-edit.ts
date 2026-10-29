// O DFL grava pontos inteiros (server/dfl-write.ts trunca antes do workflow), então a
// edição compara os dois lados truncados: sem isso uma task de 2,5 pts abria o modal
// já "alterada" e um clique em Salvar gravava 2 sem o usuário ter editado nada.
export interface PointsEdit {
  parsed: number;
  next: number;
  valid: boolean;
  changed: boolean;
  willTruncate: boolean;
}

export function taskPointsEdit(input: string, current: number): PointsEdit {
  const parsed = Number(input.replace(',', '.'));
  const valid = input.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  const next = valid ? Math.trunc(parsed) : 0;
  return {
    parsed,
    next,
    valid,
    changed: valid && next !== Math.trunc(current),
    willTruncate: valid && next !== parsed,
  };
}
