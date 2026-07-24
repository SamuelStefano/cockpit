import type { IconName } from './commandPalette.types';

export interface UiSeed { id: string; label: string; icon: IconName; prompt: string }

const ask = (what: string) =>
  `Gere ${what}. Responda APENAS com um bloco \`\`\`preview (React + Tailwind, componente App como default export), sem explicação.`;

// Seeds da paleta ("Gerar UI"): pré-preenchem o composer com um prompt que pede a
// UI já no formato ```preview — ao enviar, renderiza ao vivo no sandbox do chat.
export const UI_SEEDS: UiSeed[] = [
  { id: 'seed-landing', label: 'Gerar UI: landing page', icon: 'monitor', prompt: ask('uma landing page moderna com hero, subtítulo, CTA e três features em cards') },
  { id: 'seed-dashboard', label: 'Gerar UI: dashboard', icon: 'grip', prompt: ask('um dashboard com quatro cards de métrica, um gráfico simples e uma tabela de linhas') },
  { id: 'seed-form', label: 'Gerar UI: formulário', icon: 'pencil', prompt: ask('um formulário de cadastro elegante com nome, email, senha e botão de enviar, com estados de foco') },
  { id: 'seed-pricing', label: 'Gerar UI: pricing', icon: 'star', prompt: ask('uma seção de pricing com três planos lado a lado e destaque no plano do meio') },
];
