import { classifyLink } from './links';

export function trustedSender(frameUrl: string, isMainFrame: boolean): boolean {
  return isMainFrame && classifyLink(frameUrl) === 'app';
}

export function validBadgeCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return null;
  return Math.min(value, 999);
}
