import type { ImageResolver, ResolvedImage } from '../../components/primitives';
import { botFileKey, type BotFileData } from '../../cockpit/useBotFiles';

// A bot cites its images relative to its workspace (`![x](mock.png)`). A URL, an
// absolute path or a `..` never reaches the server from here (it refuses them too).
export function workspaceImagePath(src: string): string | null | 'unsafe' {
  const s = src.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null;
  if (s.startsWith('/') || s.startsWith('\\') || s.split(/[\\/]/).includes('..')) return 'unsafe';
  const p = s.replace(/^(\.\/)+/, '');
  return p ? p : 'unsafe';
}

function toResolved(d: BotFileData | undefined): ResolvedImage | null {
  if (!d) return null;
  if (d.status === 'ok') return d.mime.startsWith('image/') ? { status: 'ok', url: d.url } : { status: 'error', error: 'não é imagem' };
  return d;
}

export function botImageResolver(botId: string, data: Record<string, BotFileData>, fetchFile: (botId: string, path: string) => void): ImageResolver {
  return {
    get: (src) => {
      const p = workspaceImagePath(src);
      if (p === null) return null;
      if (p === 'unsafe') return { status: 'error', error: 'caminho inválido' };
      return toResolved(data[botFileKey(botId, p)]);
    },
    request: (src) => {
      const p = workspaceImagePath(src);
      if (p && p !== 'unsafe') fetchFile(botId, p);
    },
  };
}
