import type { RefObject } from 'react';
import { BitStageLayer } from './BitStageLayer';
import { useBitMischief } from './useBitMischief';
import { STAGE_BIT_SIZE } from './useSkitStage';

interface BitMischiefProps {
  textRootRef: RefObject<HTMLElement | null>;
  thinking: boolean;
  messageCount: number;
}

export function BitMischief({ textRootRef, thinking, messageCount }: BitMischiefProps) {
  const m = useBitMischief({ textRootRef, thinking, messageCount });
  return <BitStageLayer layerRef={m.layerRef} actorRef={m.actorRef} letterRef={m.letterRef} look={m.look} size={STAGE_BIT_SIZE} />;
}
