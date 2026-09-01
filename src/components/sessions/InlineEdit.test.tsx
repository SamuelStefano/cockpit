// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { InlineEdit } from './InlineEdit';

afterEach(cleanup);

const setup = (props: Partial<Parameters<typeof InlineEdit>[0]> = {}) => {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const onChange = vi.fn();
  render(<InlineEdit value="oi" label="campo" onChange={onChange} onCommit={onCommit} onCancel={onCancel} {...props} />);
  return { field: screen.getByLabelText('campo'), onCommit, onCancel, onChange };
};

describe('InlineEdit', () => {
  it('foca e seleciona ao montar (edição abre pronta pra sobrescrever)', () => {
    const { field } = setup();
    expect(document.activeElement).toBe(field);
    expect((field as HTMLInputElement).selectionStart).toBe(0);
    expect((field as HTMLInputElement).selectionEnd).toBe(2);
  });

  it('Enter salva e Escape cancela', () => {
    const { field, onCommit, onCancel } = setup();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledOnce();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('sair do campo salva, igual ao Enter', () => {
    const { field, onCommit } = setup();
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  // Sem a guarda, o Enter que confirma o candidato do IME (japonês/coreano) era
  // lido como "salvar" e gravava o texto pela metade.
  it('Enter de confirmação do IME não salva', () => {
    const { field, onCommit } = setup();
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('no textarea o Enter puro quebra linha e só Cmd/Ctrl+Enter salva', () => {
    const { field, onCommit } = setup({ multiline: true, rows: 2 });
    expect(field.tagName).toBe('TEXTAREA');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  // O card da sessão inteiro é role="button": sem barrar o clique, posicionar o
  // cursor no meio do texto trocava a sessão ativa.
  it('clique não vaza pro card', () => {
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <InlineEdit value="oi" label="preso" onChange={() => {}} onCommit={() => {}} onCancel={() => {}} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('preso'));
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
