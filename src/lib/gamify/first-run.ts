export interface OnboardingSteps {
  conversation: boolean;
  install: boolean;
}

export const ONBOARDING_STEPS_KEY = 'onboardingSteps';
export const EMPTY_STEPS: OnboardingSteps = { conversation: false, install: false };

export interface FirstRunStep {
  id: 'provider' | 'conversation' | 'install';
  label: string;
  done: boolean;
}

export function firstRunSteps(providerConnected: boolean, steps: OnboardingSteps, standalone: boolean): FirstRunStep[] {
  return [
    { id: 'provider', label: 'Conectar um provedor', done: providerConnected },
    { id: 'conversation', label: 'Fazer a primeira conversa', done: steps.conversation },
    { id: 'install', label: 'Instalar na tela inicial', done: steps.install || standalone },
  ];
}

export const firstRunDone = (steps: FirstRunStep[]): boolean => steps.every((s) => s.done);
