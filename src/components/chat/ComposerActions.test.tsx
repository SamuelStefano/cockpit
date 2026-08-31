// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ComposerActions } from './ComposerActions';

afterEach(cleanup);

function setup(over: Partial<Parameters<typeof ComposerActions>[0]> = {}) {
  const onSubmit = vi.fn();
  const onStop = vi.fn();
  render(
    <ComposerActions
      busy={false} paused={false} hasText={false} hasAtt={false} attUploading={false}
      onSubmit={onSubmit} onStop={onStop} {...over}
    />,
  );
  return { onSubmit, onStop };
}

const queue = () => screen.queryByLabelText('Enfileirar mensagem');
const stop = () => screen.queryByLabelText('Interromper resposta');

describe('ComposerActions', () => {
  it('com run em curso e texto escrito, enfileirar convive com o stop', () => {
    const { onSubmit, onStop } = setup({ busy: true, hasText: true });
    fireEvent.click(queue()!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
    fireEvent.click(stop()!);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('com run em curso o enfileirar fica no slot da direita, depois do stop', () => {
    setup({ busy: true, hasText: true });
    expect(stop()!.compareDocumentPosition(queue()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('com run em curso e composer vazio o enfileirar continua no lugar, só desabilitado', () => {
    const { onSubmit } = setup({ busy: true });
    expect(queue()).not.toBeNull();
    expect((queue() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(queue()!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('só anexo (sem texto) já habilita enfileirar', () => {
    setup({ busy: true, hasAtt: true });
    expect(queue()).not.toBeNull();
  });

  it('anexo subindo bloqueia o envio pra não perder o arquivo', () => {
    const { onSubmit } = setup({ busy: true, hasText: true, attUploading: true });
    fireEvent.click(queue()!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('idle não mostra stop e envia pelo botão', () => {
    const { onSubmit } = setup({ hasText: true });
    expect(stop()).toBeNull();
    fireEvent.click(screen.getByLabelText('Enviar mensagem'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
