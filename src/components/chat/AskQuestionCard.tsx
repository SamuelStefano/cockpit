import { useContext } from 'react';
import type { ToolCall } from '../../data/types';
import { AskQuestionMulti } from './AskQuestionMulti';
import { BotThreadContext } from './bot-thread-context';
import { ProposalCard } from './ProposalCard';
import { parseRecommended } from './recommended';
import { isLetterQuestion, useLetterQuestion } from './useLetterQuestion';

interface AskQuestionCardProps {
  tool: ToolCall;
  answerable: boolean;
  onAnswer?: (text: string) => boolean | void;
}

export function AskQuestionCard({ tool, answerable, onAnswer }: AskQuestionCardProps) {
  if (!isLetterQuestion(tool)) return <AskQuestionMulti tool={tool} answerable={answerable} onAnswer={onAnswer} />;
  return <LetterQuestion tool={tool} answerable={answerable} onAnswer={onAnswer} />;
}

function LetterQuestion({ tool, answerable, onAnswer }: AskQuestionCardProps) {
  const inTeam = useContext(BotThreadContext);
  const { question, open, picked, pick } = useLetterQuestion(tool, answerable, inTeam, onAnswer);
  if (!question) return null;
  const options = question.options.map((o) => ({ ...o, ...parseRecommended(o.label) }));
  return (
    <ProposalCard question={question.question} options={options} open={open} picked={picked} inTeam={inTeam} onPick={pick}
      image={question.image} deadline={question.deadline} />
  );
}
