import type { IconName } from '../Icon';

// Larguras de dispositivo pro preview web (react/html). `width: null` = fluido
// (100% da coluna do chat, auto-resize por altura como antes). As larguras fixas
// centralizam o iframe numa moldura mais estreita pra testar responsividade sem
// sair do chat.
export interface Viewport {
  id: string;
  label: string;
  icon: IconName;
  width: number | null;
}

export const VIEWPORTS: Viewport[] = [
  { id: 'fluid', label: 'Fluido', icon: 'maximize', width: null },
  { id: 'desktop', label: 'Desktop', icon: 'monitor', width: 1280 },
  { id: 'tablet', label: 'Tablet', icon: 'tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', icon: 'smartphone', width: 390 },
];
