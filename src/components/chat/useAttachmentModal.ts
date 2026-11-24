import { useEffect, useMemo } from 'react';
import type { AttachmentPreview } from '../../useCockpit';
import { attachmentKind, type AttachmentKind } from '../../lib/attachment-kind';
import { b64ToObjectUrl } from '../../lib/blob-url';
import { useEscapeLayer } from '../primitives/useEscapeLayer';

// O conteúdo chega como base64 pela WS (não há endpoint HTTP de arquivos no
// backend); vira blob URL pra <img>/<video> renderizarem sem estourar o atributo
// src com data-URI gigante. Revoga no cleanup pra não vazar memória.
export function useAttachmentModal(att: AttachmentPreview, onClose: () => void): { kind: AttachmentKind; url: string | null } {
  const { kind, mime } = attachmentKind(att.name);
  const url = useMemo(() => (att.dataB64 ? b64ToObjectUrl(att.dataB64, mime) : null), [att.dataB64, mime]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // In the shared Escape stack (useEscapeLayer): opened on top of a Modal, this
  // overlay closes first instead of the Modal underneath.
  useEscapeLayer(true, onClose);

  return { kind, url };
}
