import type { Message } from '../data/types';

export type SharedBlock =
  | { type: 'text'; md: string }
  | { type: 'code'; lang: string; code: string }
  | { type: 'tool'; label: string };

export type SharedMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; blocks: SharedBlock[] }
  | { role: 'compact' };

export interface ShareSnapshot {
  v: 1;
  title: string;
  createdAt: number;
  messages: SharedMessage[];
}

// Tool output can carry secrets, so only the label/command ever leaves the device.
export function buildShareSnapshot(title: string, messages: Message[]): ShareSnapshot {
  const out: SharedMessage[] = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', text: m.text });
    else if (m.role === 'compact') out.push({ role: 'compact' });
    else {
      const blocks: SharedBlock[] = [];
      for (const b of m.blocks) {
        if (b.type === 'text') blocks.push({ type: 'text', md: b.md });
        else if (b.type === 'code') blocks.push({ type: 'code', lang: b.lang || '', code: b.code });
        else if (b.type === 'tool') blocks.push({ type: 'tool', label: b.tool.command || b.tool.label });
      }
      out.push({ role: 'assistant', blocks });
    }
  }
  return { v: 1, title, createdAt: Date.now(), messages: out };
}

export function shareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const sharePath = (uid: string, id: string) => `${uid}/${id}.json`;

// The uid segment excludes dots so `..` can never reach the storage URL.
const SHARE_ROUTE = /^\/s\/([A-Za-z0-9-]{1,64})\/([A-Za-z0-9_-]{1,64})$/;

export function parseSharePath(pathname: string): { uid: string; id: string } | null {
  const m = SHARE_ROUTE.exec(pathname);
  return m ? { uid: m[1], id: m[2] } : null;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function validBlock(b: unknown): boolean {
  if (!isObj(b)) return false;
  if (b.type === 'text') return isStr(b.md);
  if (b.type === 'code') return isStr(b.lang) && isStr(b.code);
  if (b.type === 'tool') return isStr(b.label);
  return false;
}

function validMessage(m: unknown): boolean {
  if (!isObj(m)) return false;
  if (m.role === 'user') return isStr(m.text);
  if (m.role === 'compact') return true;
  return m.role === 'assistant' && Array.isArray(m.blocks) && m.blocks.every(validBlock);
}

export function parseShareSnapshot(data: unknown): ShareSnapshot | null {
  if (!isObj(data) || data.v !== 1 || !isStr(data.title) || typeof data.createdAt !== 'number') return null;
  if (!Array.isArray(data.messages) || !data.messages.every(validMessage)) return null;
  return data as unknown as ShareSnapshot;
}
