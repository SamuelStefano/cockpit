export type Transport = 'sealed' | 'local' | 'plain';

export const SECRET_FRAMES: ReadonlySet<string> = new Set(['vault-put', 'byo-key-set']);

export const SECRET_CHANNEL_MESSAGE = 'Conecte pelo canal selado para salvar segredos';

export function secretFrameAllowed(t: string, transport: Transport): boolean {
  return !SECRET_FRAMES.has(t) || transport !== 'plain';
}
