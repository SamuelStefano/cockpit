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

describe('ComposerActions primary slot', () => {
  const mic = (over: Partial<{ supported: boolean; listening: boolean }> = {}) => ({ supported: true, listening: false, error: null, toggle: vi.fn(), ...over });

  it('shows the dictation mic and dictates on click', () => {
    const m = mic();
    setup({ mic: m });
    fireEvent.click(screen.getByLabelText('Ditar por voz'));
    expect(m.toggle).toHaveBeenCalledTimes(1);
  });

  it('keeps the mic next to send once there is text', () => {
    setup({ mic: mic(), hasText: true });
    expect(screen.getByLabelText('Ditar por voz')).toBeTruthy();
    expect(screen.getByLabelText('Enviar mensagem')).toBeTruthy();
  });

  it('turns the mic into stop-dictation while listening', () => {
    const m = mic({ listening: true });
    setup({ mic: m, hasText: true });
    fireEvent.click(screen.getByLabelText('Parar de ditar'));
    expect(m.toggle).toHaveBeenCalledTimes(1);
  });

  it('has no mic when dictation is unsupported and send stays disabled', () => {
    setup({ mic: mic({ supported: false }) });
    expect(screen.queryByLabelText('Ditar por voz')).toBeNull();
    expect((screen.getByLabelText('Enviar mensagem') as HTMLButtonElement).disabled).toBe(true);
  });

  it('empty field: the main button stays a disabled send, never a call', () => {
    setup({ mic: mic() });
    expect(screen.queryByLabelText('Ligar')).toBeNull();
    expect((screen.getByLabelText('Enviar mensagem') as HTMLButtonElement).disabled).toBe(true);
  });

  it('never offers the call or mic while a turn runs', () => {
    setup({ busy: true, mic: mic() });
    expect(screen.queryByLabelText('Ligar')).toBeNull();
    expect(screen.queryByLabelText('Ditar por voz')).toBeNull();
  });
});
