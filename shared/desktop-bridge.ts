export interface DeckDesktopLink {
  box: string | null;
  session: string;
}

export interface DeckDesktopBridge {
  apiVersion: number;
  appVersion: string;
  focusWindow: () => void;
  setBadge: (count: number) => void;
  flashWindow?: () => void;
  onLink: (cb: (link: DeckDesktopLink) => void) => void;
}
