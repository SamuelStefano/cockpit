import { useEffect, useMemo } from 'react';
import { attachmentKind, type AttachmentKind } from '../../lib/attachment-kind';
import { b64ToObjectUrl } from '../../lib/blob-url';

// Thumbnail do chip de imagem: pede o conteúdo via att-open (mesmo canal do
// modal) e converte em object URL. Só imagens pedem — vídeo/pdf/etc ficam no
// ícone, senão todo chip baixaria o arquivo inteiro à toa.
export function useAttachmentChip(
  path: string,
  name: string,
  thumbB64: string | undefined,
  onThumb?: (path: string) => void,
): { kind: AttachmentKind; url: string | null } {
  const { kind, mime } = attachmentKind(name);
  const isImage = kind === 'image';

  useEffect(() => {
    if (isImage && thumbB64 === undefined) onThumb?.(path);
  }, [isImage, thumbB64, onThumb, path]);

  const url = useMemo(
    () => (isImage && thumbB64 ? b64ToObjectUrl(thumbB64, mime) : null),
    [isImage, thumbB64, mime],
  );
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return { kind, url };
}
