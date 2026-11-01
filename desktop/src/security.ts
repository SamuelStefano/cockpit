import { session, shell, type WebContents } from 'electron';
import { APP_ORIGIN, canGrantPermission, classifyLink } from './links';

function openExternally(url: string): void {
  if (classifyLink(url) === 'external') void shell.openExternal(url);
  else console.warn('[deck] blocked link', url.slice(0, 80));
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function hardenPermissions(): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(canGrantPermission(permission, originOf(details.requestingUrl), details.isMainFrame));
  });
  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    return canGrantPermission(permission, originOf(requestingOrigin), details.isMainFrame);
  });
}

export function hardenNavigation(contents: WebContents): void {
  const guardTop = (event: { preventDefault(): void }, url: string) => {
    if (classifyLink(url) === 'app') return;
    event.preventDefault();
    openExternally(url);
  };
  contents.on('will-navigate', (event) => guardTop(event, event.url));
  contents.on('will-redirect', (event) => guardTop(event, event.url));
  // Preview frames load arbitrary https pages by design; only OS-handled schemes stop here.
  contents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame) return;
    if (/^(https?|blob|data|about):/.test(event.url)) return;
    event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

export { APP_ORIGIN };
