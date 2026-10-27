export interface PlatformNav {
  userAgentData?: { platform?: string };
  userAgent?: string;
}

export function isWindowsBrowser(nav: PlatformNav | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav) return false;
  const platform = nav.userAgentData?.platform;
  if (platform) return /windows/i.test(platform);
  return /Windows/.test(nav.userAgent ?? '');
}
