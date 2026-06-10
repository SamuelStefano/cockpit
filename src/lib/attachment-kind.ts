// O servidor não guarda o content-type do upload (só bytes + nome), então o tipo
// do preview é inferido da extensão do nome original aqui no cliente.
export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'other';

const EXT_MIME: Record<string, { kind: AttachmentKind; mime: string }> = {
  png: { kind: 'image', mime: 'image/png' },
  jpg: { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  gif: { kind: 'image', mime: 'image/gif' },
  webp: { kind: 'image', mime: 'image/webp' },
  svg: { kind: 'image', mime: 'image/svg+xml' },
  avif: { kind: 'image', mime: 'image/avif' },
  bmp: { kind: 'image', mime: 'image/bmp' },
  mp4: { kind: 'video', mime: 'video/mp4' },
  webm: { kind: 'video', mime: 'video/webm' },
  mov: { kind: 'video', mime: 'video/quicktime' },
  m4v: { kind: 'video', mime: 'video/mp4' },
  mp3: { kind: 'audio', mime: 'audio/mpeg' },
  wav: { kind: 'audio', mime: 'audio/wav' },
  ogg: { kind: 'audio', mime: 'audio/ogg' },
  m4a: { kind: 'audio', mime: 'audio/mp4' },
  pdf: { kind: 'pdf', mime: 'application/pdf' },
};

export function attachmentKind(name: string): { kind: AttachmentKind; mime: string } {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  return EXT_MIME[ext] ?? { kind: 'other', mime: 'application/octet-stream' };
}

export function attachmentIcon(kind: AttachmentKind): 'image' | 'play' | 'volume' | 'file' {
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'play';
  if (kind === 'audio') return 'volume';
  return 'file';
}
