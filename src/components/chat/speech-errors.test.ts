import { describe, it, expect } from 'vitest';
import { isFatalSpeechError, speechErrorMessage } from './speech-errors';

describe('isFatalSpeechError', () => {
  it('permissão é fatal', () => {
    expect(isFatalSpeechError('not-allowed')).toBe(true);
    expect(isFatalSpeechError('service-not-allowed')).toBe(true);
  });

  it('pausa/rede/abort são transitórios', () => {
    expect(isFatalSpeechError('no-speech')).toBe(false);
    expect(isFatalSpeechError('network')).toBe(false);
    expect(isFatalSpeechError('aborted')).toBe(false);
  });
});

describe('speechErrorMessage', () => {
  it('orienta a liberar o microfone na permissão negada', () => {
    expect(speechErrorMessage('not-allowed')).toMatch(/microfone/i);
  });

  it('tem mensagem padrão para código desconhecido', () => {
    expect(speechErrorMessage('weird-code')).toMatch(/indisponível/i);
  });
});
