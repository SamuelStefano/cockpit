import { describe, it, expect } from 'vitest';
import { replaceBody, parseAttachments, attachmentTextBlock } from './parse-attachments';

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

  it('descarta o bloco de texto inline do .docx e mantém o chip no original', () => {
    const text = `[anexo: a/1-x-proposta.docx]\n${attachmentTextBlock('proposta.docx', 'linha 1\nlinha 2')}\n\nanalisa isso`;
    const r = parseAttachments(text);
    expect(r.attachments).toEqual([{ path: 'a/1-x-proposta.docx', name: 'proposta.docx' }]);
    expect(r.body).toBe('analisa isso');
  });
});

// Editar um item da fila reescreve só o corpo — os marcadores de anexo do wire
// original continuam amarrados àquele prompt.
describe('replaceBody', () => {
  it('preserva o marcador de anexo e troca o corpo', () => {
    expect(replaceBody('[anexo: a/1-x-foto.png]\n\nvelho', 'novo'))
      .toBe('[anexo: a/1-x-foto.png]\n\nnovo');
  });

  it('preserva o bloco de texto inline do .docx', () => {
    const raw = `[anexo: a/1-x-p.docx]\n${attachmentTextBlock('p.docx', 'conteudo')}\n\nvelho`;
    const out = replaceBody(raw, 'novo');
    expect(parseAttachments(out)).toEqual({ attachments: [{ path: 'a/1-x-p.docx', name: 'p.docx' }], body: 'novo' });
  });

  it('sem anexo devolve só o corpo novo', () => {
    expect(replaceBody('velho', 'novo')).toBe('novo');
  });

  it('bloco truncado não empilha o corpo antigo a cada edição', () => {
    const raw = '[anexo: a/1-x-p.docx]\n[anexo-texto: p.docx]\nconteudo\nvelho';
    const um = replaceBody(raw, 'novo');
    expect(um).toBe('[anexo: a/1-x-p.docx]\n\nnovo');
    expect(replaceBody(um, 'novo 2')).toBe('[anexo: a/1-x-p.docx]\n\nnovo 2');
  });
});
