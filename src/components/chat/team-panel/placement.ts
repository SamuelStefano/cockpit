export type PanelPlacement = 'none' | 'aside' | 'drawer' | 'hero-drawer';

export function panelPlacement({ open, isMobile, hero }: { open: boolean; isMobile: boolean; hero: boolean }): PanelPlacement {
  if (!open) return 'none';
  if (!isMobile) return 'aside';
  return hero ? 'hero-drawer' : 'drawer';
}
