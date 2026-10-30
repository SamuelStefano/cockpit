import type { EventCtx, GameState } from './types';
import { EGG_IDS } from './eggs';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  hidden?: true;
  test: (s: GameState, c: EventCtx) => boolean;
}

// Routes every role can reach are not enough to finish this: pontos is root-only
// and left out on purpose, so an admin can still complete it.
export const TRACKED_ROUTES = ['/', '/canvas', '/skills', '/conexoes', '/docs', '/equipe/rotinas', '/equipe/memoria', '/configuracoes'];

const total = (s: GameState, k: string) => s.totals[k] ?? 0;
const turnHour = (c: EventCtx) => (c.event.type === 'turn_done' ? c.now.getHours() : -1);
const egg = (id: string) => (s: GameState) => s.eggs.includes(id);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-turn', title: 'Primeiro turno', desc: 'Termine um turno com um agente', icon: '🚀', test: (s) => total(s, 'turn_done') >= 1 },
  { id: 'turns-10', title: 'Pegando o jeito', desc: 'Termine 10 turnos', icon: '⚙️', test: (s) => total(s, 'turn_done') >= 10 },
  { id: 'turns-100', title: 'Centenário', desc: 'Termine 100 turnos', icon: '💯', test: (s) => total(s, 'turn_done') >= 100 },
  { id: 'turns-1000', title: 'Mil e uma entregas', desc: 'Termine 1000 turnos', icon: '🏔️', test: (s) => total(s, 'turn_done') >= 1000 },
  { id: 'streak-3', title: 'Embalado', desc: 'Use o Deck 3 dias seguidos', icon: '🔥', test: (s) => s.streak.best >= 3 },
  { id: 'streak-7', title: 'Semana de fogo', desc: 'Use o Deck 7 dias seguidos', icon: '🔥', test: (s) => s.streak.best >= 7 },
  { id: 'streak-30', title: 'Hábito de ferro', desc: 'Use o Deck 30 dias seguidos', icon: '🏆', test: (s) => s.streak.best >= 30 },
  { id: 'night-owl', title: 'Coruja', desc: 'Termine um turno entre 0h e 5h', icon: '🦉', hidden: true, test: (_s, c) => turnHour(c) >= 0 && turnHour(c) < 5 },
  { id: 'early-bird', title: 'Madrugador', desc: 'Termine um turno entre 5h e 7h', icon: '🐦', hidden: true, test: (_s, c) => turnHour(c) >= 5 && turnHour(c) < 7 },
  { id: 'weekend', title: 'Guerreiro de fim de semana', desc: 'Termine 5 turnos em sábados e domingos', icon: '🛡️', hidden: true, test: (s) => total(s, 'weekend_turns') >= 5 },
  { id: 'multitasker', title: 'Multitarefa', desc: 'Termine um turno com 3 ou mais rodando juntos', icon: '🧵', test: (_s, c) => (c.event.type === 'turn_done' && (c.event.concurrent ?? 0) >= 3) },
  { id: 'survivor', title: 'Sobrevivente', desc: 'Sobreviva a 10 erros de turno', icon: '🩹', test: (s) => total(s, 'turn_error') >= 10 },
  { id: 'comeback', title: 'Volta por cima', desc: 'Termine um turno logo depois de um erro', icon: '🔄', hidden: true, test: (s, c) => c.event.type === 'turn_done' && total(s, 'comebacks') >= 1 },
  { id: 'egg-konami', title: '↑↑↓↓←→←→BA', desc: 'Você conhece os clássicos', icon: '🕹️', hidden: true, test: egg('konami') },
  { id: 'egg-iddqd', title: 'Modo deus', desc: 'Agentes não erram (mentira)', icon: '😇', hidden: true, test: egg('iddqd') },
  { id: 'egg-matrix', title: 'Pílula vermelha', desc: 'Siga o coelho branco', icon: '💊', hidden: true, test: egg('matrix') },
  { id: 'egg-poke', title: 'Cutucada', desc: 'O Bit sentiu', icon: '👉', hidden: true, test: egg('poke') },
  { id: 'egg-dizzy', title: 'Tonteira', desc: 'Cutucou demais', icon: '💫', hidden: true, test: egg('dizzy') },
  { id: 'egg-sudo', title: 'Sudo sanduíche', desc: 'Permissão concedida', icon: '🥪', hidden: true, test: egg('sudo') },
  { id: 'egg-halloween', title: 'Doce ou travessura', desc: 'Dia 31 de outubro', icon: '🎃', hidden: true, test: egg('halloween') },
  { id: 'egg-friday', title: 'Sexta, 16h', desc: 'Deploy? Coragem.', icon: '🍻', hidden: true, test: egg('friday') },
  { id: 'all-eggs', title: 'Caçador de segredos', desc: 'Encontre todos os segredos', icon: '🥚', hidden: true, test: (s) => EGG_IDS.every((e) => s.eggs.includes(e)) },
  { id: 'runner-100', title: 'Primeiros passos', desc: 'Faça 100 pontos no Bit Runner', icon: '👟', test: (s) => s.highScore >= 100 },
  { id: 'runner-500', title: 'Em velocidade', desc: 'Faça 500 pontos no Bit Runner', icon: '⚡', test: (s) => s.highScore >= 500 },
  { id: 'runner-1000', title: 'Lenda do Runner', desc: 'Faça 1000 pontos no Bit Runner', icon: '👑', test: (s) => s.highScore >= 1000 },
  { id: 'fish-1', title: 'Primeira fisgada', desc: 'Deixe o Bit pescar algo enquanto o agente trabalha', icon: '🎣', test: (s) => total(s, 'fish_caught') >= 1 },
  { id: 'fish-25', title: 'Pescador de domingo', desc: 'Pesque 25 coisas com o Bit', icon: '🪣', test: (s) => total(s, 'fish_caught') >= 25 },
  { id: 'fish-star', title: 'Estrela cadente', desc: 'Pesque uma estrela', icon: '🌟', hidden: true, test: (s) => total(s, 'fish_rare') >= 1 },
  { id: 'explorer', title: 'Explorador', desc: 'Visite todas as telas do menu', icon: '🧭', test: (s) => TRACKED_ROUTES.every((r) => s.routes.includes(r)) },
];

export const achievementById = (id: string): Achievement | undefined => ACHIEVEMENTS.find((a) => a.id === id);
