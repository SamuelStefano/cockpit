import { describe, it, expect } from 'vitest';
import { parseAttachments } from './parse-attachments';

describe('parseAttachments', () => {
  it('separa marcadores de anexo do corpo e limpa o nome', () => {
    const text = '[anexo: attachments/s1/1717000000-ab12cd-foto.png]\n\nolha essa imagem';
    expect(parseAttachments(text)).toEqual({
      attachments: [{ path: 'attachments/s1/1717000000-ab12cd-foto.png', name: 'foto.png' }],
      body: 'olha essa imagem',
    });
  });

  it('suporta múltiplos anexos', () => {
    const text = '[anexo: a/1-x-a.pdf]\n[anexo: a/2-y-b.csv]\n\ntexto';
    const r = parseAttachments(text);
    expect(r.attachments.map((a) => a.name)).toEqual(['a.pdf', 'b.csv']);
    expect(r.body).toBe('texto');
  });

  it('texto sem anexo passa intacto', () => {
    expect(parseAttachments('só texto')).toEqual({ attachments: [], body: 'só texto' });
  });

  it('anexo sem corpo retorna body vazio', () => {
    expect(parseAttachments('[anexo: a/1-z-só.png]')).toEqual({
      attachments: [{ path: 'a/1-z-só.png', name: 'só.png' }],
      body: '',
    });
  });
});
