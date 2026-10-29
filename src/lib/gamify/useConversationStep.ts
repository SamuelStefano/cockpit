import { useEffect } from 'react';
import { usePersisted } from '../persist';
import { EMPTY_STEPS, ONBOARDING_STEPS_KEY, type OnboardingSteps } from './first-run';

// Ticks the "first conversation" onboarding step once any session exists.
export function useConversationStep(hasSessions: boolean): void {
  const [steps, setSteps] = usePersisted<OnboardingSteps>(ONBOARDING_STEPS_KEY, EMPTY_STEPS);
  useEffect(() => {
    if (hasSessions && !steps.conversation) setSteps({ ...steps, conversation: true });
  }, [hasSessions, steps, setSteps]);
}
