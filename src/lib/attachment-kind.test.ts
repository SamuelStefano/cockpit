import { describe, it, expect } from 'vitest';
import { attachmentKind, attachmentIcon } from './attachment-kind';

describe('attachmentKind', () => {
  it('classifica imagens pelas extensões comuns', () => {
    expect(attachmentKind('foto.png')).toEqual({ kind: 'image', mime: 'image/png' });
    expect(attachmentKind('Print Tela.JPEG')).toEqual({ kind: 'image', mime: 'image/jpeg' });
    expect(attachmentKind('anim.webp').kind).toBe('image');
  });

  it('classifica vídeo e áudio', () => {
    expect(attachmentKind('clip.mp4')).toEqual({ kind: 'video', mime: 'video/mp4' });
    expect(attachmentKind('gravacao.MOV').kind).toBe('video');
    expect(attachmentKind('audio.mp3')).toEqual({ kind: 'audio', mime: 'audio/mpeg' });
  });

  it('classifica pdf', () => {
    expect(attachmentKind('doc.pdf')).toEqual({ kind: 'pdf', mime: 'application/pdf' });
  });

  it('cai em other para extensão desconhecida ou ausente', () => {
    expect(attachmentKind('dados.csv').kind).toBe('other');
    expect(attachmentKind('sem-extensao').kind).toBe('other');
    expect(attachmentKind('arquivo.').kind).toBe('other');
  });
});

describe('attachmentIcon', () => {
  it('mapeia kind pra ícone do design system', () => {
    expect(attachmentIcon('image')).toBe('image');
    expect(attachmentIcon('video')).toBe('play');
    expect(attachmentIcon('audio')).toBe('volume');
    expect(attachmentIcon('pdf')).toBe('file');
    expect(attachmentIcon('other')).toBe('file');
  });
});
