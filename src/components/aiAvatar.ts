// Presets do ícone da IA (avatar do Claude no chat). 'claude' é o burst laranja
// da marca (ícone próprio); os demais são emojis divertidos sobre um gradiente.
// A escolha vive no localStorage (sync entre abas via usePersisted) — sem backend.

export interface AiAvatarPreset {
  id: string;
  label: string;
  emoji?: string; // ausente = render do ícone 'claude' da marca
  bg: string;
}

export const AI_AVATAR_KEY = 'ai.avatar';
export const AI_AVATAR_DEFAULT = 'claude';

export const AI_AVATARS: AiAvatarPreset[] = [
  { id: 'claude', label: 'Claude', bg: 'radial-gradient(circle at 32% 28%, #fb923c, #ea580c)' },
  { id: 'crab', label: 'Caranguejo', emoji: '🦀', bg: 'radial-gradient(circle at 32% 28%, #fb7185, #e11d48)' },
  { id: 'robot', label: 'Robô', emoji: '🤖', bg: 'radial-gradient(circle at 32% 28%, #94a3b8, #475569)' },
  { id: 'alien', label: 'Alien', emoji: '👾', bg: 'radial-gradient(circle at 32% 28%, #a78bfa, #7c3aed)' },
  { id: 'fox', label: 'Raposa', emoji: '🦊', bg: 'radial-gradient(circle at 32% 28%, #fb923c, #c2410c)' },
  { id: 'cat', label: 'Gato', emoji: '🐱', bg: 'radial-gradient(circle at 32% 28%, #fbbf24, #b45309)' },
  { id: 'panda', label: 'Panda', emoji: '🐼', bg: 'radial-gradient(circle at 32% 28%, #d4d4d8, #52525b)' },
  { id: 'dragon', label: 'Dragão', emoji: '🐉', bg: 'radial-gradient(circle at 32% 28%, #34d399, #047857)' },
  { id: 'owl', label: 'Coruja', emoji: '🦉', bg: 'radial-gradient(circle at 32% 28%, #a3a3a3, #57534e)' },
  { id: 'octopus', label: 'Polvo', emoji: '🐙', bg: 'radial-gradient(circle at 32% 28%, #f472b6, #be185d)' },
  { id: 'ninja', label: 'Ninja', emoji: '🥷', bg: 'radial-gradient(circle at 32% 28%, #64748b, #1e293b)' },
  { id: 'ghost', label: 'Fantasma', emoji: '👻', bg: 'radial-gradient(circle at 32% 28%, #c7d2fe, #6366f1)' },
  { id: 'fire', label: 'Fogo', emoji: '🔥', bg: 'radial-gradient(circle at 32% 28%, #fb923c, #dc2626)' },
  { id: 'star', label: 'Estrela', emoji: '🌟', bg: 'radial-gradient(circle at 32% 28%, #fde047, #ca8a04)' },
  { id: 'rocket', label: 'Foguete', emoji: '🚀', bg: 'radial-gradient(circle at 32% 28%, #818cf8, #4338ca)' },
  { id: 'wizard', label: 'Mago', emoji: '🧙', bg: 'radial-gradient(circle at 32% 28%, #c084fc, #6b21a8)' },
  { id: 'frog', label: 'Sapo', emoji: '🐸', bg: 'radial-gradient(circle at 32% 28%, #86efac, #15803d)' },
  { id: 'brain', label: 'Cérebro', emoji: '🧠', bg: 'radial-gradient(circle at 32% 28%, #f9a8d4, #db2777)' },
];

export function findAiAvatar(id: string): AiAvatarPreset {
  return AI_AVATARS.find((a) => a.id === id) ?? AI_AVATARS[0];
}
