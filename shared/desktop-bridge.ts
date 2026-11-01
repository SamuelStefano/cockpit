export interface DeckDesktopBridge {
  apiVersion: number;
  appVersion: string;
  focusWindow: () => void;
  setBadge: (count: number) => void;
}
