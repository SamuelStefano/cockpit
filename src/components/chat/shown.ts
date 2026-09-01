import type { Message, ToolCall } from '../../data/types';

// Uma nota de bastidor: texto que o agente escreveu no meio do turno pra narrar o
// próximo passo, não a resposta final. Guarda o id da mensagem de origem + índice
// do bloco pra chave estável de render.
export interface NarrationNote {
  id: string;
  md: string;
  ts?: number;
}

// Mensagem sintética (só no cliente) derivada da thread — o backend não manda
// nenhuma delas. `digest` carrega as ferramentas do turno numa caixa só;
// `narration` carrega as notas de bastidor do turno na caixa seguinte.
export type ShownMessage = Message & { digest?: ToolCall[]; narration?: NarrationNote[] };
