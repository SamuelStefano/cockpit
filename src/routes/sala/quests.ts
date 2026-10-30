export interface SalaQuest {
  title: string;
  detail: string;
  tone: 'orange' | 'yellow' | 'red';
  href?: string;
}

export const CALL_QUESTS: SalaQuest[] = [
  { title: 'Modo x1', detail: 'Amigo entra sem role nova.', tone: 'orange', href: 'https://github.com/iterahq/itera-player/pull/986' },
  { title: 'Pontos', detail: 'Motor de pontos, sem migration nesta PR.', tone: 'orange', href: 'https://github.com/iterahq/itera-player/pull/982' },
  { title: 'Loot e roupa', detail: 'Itens depois dos pontos.', tone: 'orange', href: 'https://github.com/iterahq/itera-player/pull/984' },
  { title: 'Chefão', detail: 'XP maior e roletas no fim da lição.', tone: 'orange', href: 'https://github.com/iterahq/itera-player/pull/988' },
  { title: 'Migration de rewards', detail: 'Parada. Só você libera.', tone: 'red', href: 'https://github.com/iterahq/itera-player/pull/981' },
  { title: 'Migration de salas', detail: 'Parada. Só você libera.', tone: 'red', href: 'https://github.com/iterahq/itera-player/pull/985' },
  { title: 'Sandbox final', detail: 'Conteúdo de lição. Espera você.', tone: 'yellow', href: 'https://github.com/iterahq/itera-player/pull/983' },
  { title: 'Balão e conceito', detail: 'A call mandou prototipar no Labs com o Tainan.', tone: 'yellow' },
];
