import { useState } from 'react';
import { Icon } from '../primitives';
import type { ToolCall, ToolQuestion } from '../../data/mock';

interface AskQuestionCardProps {
  tool: ToolCall;
  // answerable = é a última mensagem, o turno acabou e ninguém respondeu ainda.
  // Só então os botões clicam; fora disso o card é histórico (read-only).
  answerable: boolean;
  onAnswer?: (text: string) => void;
}

// AskUserQuestion: o Claude pediu uma escolha de múltipla-escolha. Como o `claude -p`
// é single-shot (stdin ignorado), a resposta não volta no mesmo turno — a seleção do
// usuário vira o PRÓXIMO prompt e o --resume continua a conversa. Sem este card o turno
// ficava travado esperando um input que nunca chegava.
export function AskQuestionCard({ tool, answerable, onAnswer }: AskQuestionCardProps) {
  const questions = tool.questions ?? [];
  const [picks, setPicks] = useState<Record<number, Set<string>>>({});
  const [sent, setSent] = useState(false);

  if (!questions.length) return null;

  const toggle = (qi: number, label: string, multi: boolean) => {
    if (!answerable || sent) return;
    setPicks((prev) => {
      const cur = new Set(prev[qi] ?? []);
      if (multi) {
        cur.has(label) ? cur.delete(label) : cur.add(label);
      } else {
        cur.clear();
        cur.add(label);
      }
      return { ...prev, [qi]: cur };
    });
  };

  const everyAnswered = questions.every((_, qi) => (picks[qi]?.size ?? 0) > 0);

  const submit = () => {
    if (!answerable || sent || !everyAnswered || !onAnswer) return;
    const text = questions
      .map((q, qi) => {
        const chosen = [...(picks[qi] ?? [])];
        const head = q.header || q.question;
        return `${head}: ${chosen.join(', ')}`;
      })
      .join('\n');
    setSent(true);
    onAnswer(text);
  };

  const locked = !answerable || sent;

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-sky-500/30 bg-sky-500/[0.06]">
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
          <Icon name="message" size={13} />
        </span>
        <span className="text-[12px] font-medium text-sky-100">
          {sent ? 'Resposta enviada' : answerable ? 'O Claude precisa da sua escolha' : 'Pergunta do Claude'}
        </span>
      </div>

      <div className="space-y-3 px-3 pb-3">
        {questions.map((q: ToolQuestion, qi) => (
          <div key={qi} className="space-y-1.5">
            {q.header && (
              <span className="inline-block rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300/90">
                {q.header}
              </span>
            )}
            <p className="text-[13px] leading-relaxed text-neutral-200">{q.question}</p>
            <div className="flex flex-col gap-1.5">
              {q.options.map((opt, oi) => {
                const picked = picks[qi]?.has(opt.label) ?? false;
                return (
                  <button
                    key={oi}
                    onClick={() => toggle(qi, opt.label, q.multiSelect)}
                    disabled={locked}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                      picked
                        ? 'border-sky-400/50 bg-sky-500/15'
                        : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                    } ${locked ? 'cursor-default opacity-80' : ''}`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border text-sky-300 ${
                        q.multiSelect ? 'rounded' : 'rounded-full'
                      } ${picked ? 'border-sky-400 bg-sky-500/30' : 'border-neutral-600'}`}
                    >
                      {picked && <Icon name="check" size={11} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-neutral-100">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[11.5px] leading-snug text-neutral-400">{opt.description}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {answerable && !sent && (
          <button
            onClick={submit}
            disabled={!everyAnswered}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-[12px] font-medium text-sky-100 transition enabled:hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="check" size={13} /> Enviar resposta
          </button>
        )}
      </div>
    </div>
  );
}
