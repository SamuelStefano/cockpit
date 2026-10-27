export type VersionKind = 'agent' | 'skill';

export const VERSION_ID_RE = /^\d{13}-[0-9a-f]{8}$/;
export const MAX_VERSIONS_PER_ITEM = 50;

export interface VersionMeta {
  version: string;
  ts: number;
  bytes: number;
  deleted: boolean;
  note?: string;
}
