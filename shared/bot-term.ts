// One Deck terminal per bot, opened in its workspace. Same id on every device,
// so taking over from the phone reattaches the session opened on the desktop.
export function botTermId(botId: string): string {
  return `bot-${botId}`;
}
