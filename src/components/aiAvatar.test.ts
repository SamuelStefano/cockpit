import { describe, it, expect } from 'vitest';
import { AI_AVATARS, AI_AVATAR_DEFAULT, findAiAvatar } from './aiAvatar';

describe('findAiAvatar', () => {
  it('acha um preset por id', () => {
    expect(findAiAvatar('crab').label).toBe('Caranguejo');
  });

  it('cai no primeiro preset (claude) quando o id é desconhecido', () => {
    const fallback = findAiAvatar('não-existe');
    expect(fallback.id).toBe(AI_AVATAR_DEFAULT);
    expect(fallback).toBe(AI_AVATARS[0]);
  });

  it('o default aponta pra um preset real da lista', () => {
    expect(AI_AVATARS.some((a) => a.id === AI_AVATAR_DEFAULT)).toBe(true);
  });

  it('todo preset tem id e bg, e ids são únicos', () => {
    const ids = AI_AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AI_AVATARS) {
      expect(a.id).toBeTruthy();
      expect(a.bg).toBeTruthy();
    }
  });
});
