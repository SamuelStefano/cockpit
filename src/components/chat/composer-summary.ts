import type { Effort, ModelInfo } from '../../../shared/protocol';
import { prettyModel } from './toolbar-format';
import { effortLabel } from './effort-levels';

// Resumo do que vale pro PRÓXIMO prompt, pro chip que substitui os pickers no
// celular. Sem ele a barra rolava na horizontal e o modelo ficava fora da tela —
// dava pra conversar uma sessão inteira sem saber com quem se estava falando.
export function composerSummary(model: string, models: ModelInfo[], effort: Effort): string {
  const info = models.find((m) => m.id === model);
  const label = prettyModel(model, info?.displayName) || model || 'modelo';
  return `${label} · ${effortLabel(effort).toLowerCase()}`;
}
