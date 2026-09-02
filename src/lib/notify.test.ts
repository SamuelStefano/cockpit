// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTitleBase, notifyTurnDone, notifyTurnError, requestNotifyPermission, setBadge } from './notify';
import { NOTIFY_SOUND_KEY } from './prefs';

// O gate de vibração é `matchMedia('(pointer: coarse)')` e o jsdom devolve sempre
// matches:false — sem stub nenhum teste de vibração exercitaria o ramo do toque.
function setPointer(kind: 'coarse' | 'fine') {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes(kind), media: q }));
}

// Sobrescreve visibilityState (read-only no jsdom) pra exercitar os ramos
// "aba escondida" vs "aba visível" que gateiam todo o módulo.
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

// O módulo guarda `flashing` em estado de módulo, restaurado só quando a aba
// volta a ficar visível. Entre testes força-se visível + visibilitychange pra
// drenar qualquer flash pendente, senão o estado vaza pro próximo teste.
function resetState() {
  setVisibility('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  document.title = 'Deck';
  setTitleBase('Deck');
}

describe('setTitleBase / flash', () => {
  beforeEach(() => {
    resetState();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reflete o título base direto quando não está em flash', () => {
    setTitleBase('▶1 — Deck');
    expect(document.title).toBe('▶1 — Deck');
  });

  it('não sobrescreve o flash em andamento, mas guarda a base nova', () => {
    setVisibility('hidden');
    notifyTurnDone('sessão x'); // entra em flash: title vira "✦ Deck"
    expect(document.title).toBe('✦ Deck');

    setTitleBase('▶2 — Deck'); // chega update de atividade durante o flash
    expect(document.title).toBe('✦ Deck'); // flash preservado

    // ao voltar pra aba, restaura a base MAIS RECENTE, não a antiga
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.title).toBe('▶2 — Deck');
  });
});

describe('notifyTurnDone', () => {
  beforeEach(() => {
    resetState();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('é no-op quando a aba está visível', () => {
    notifyTurnDone('sessão');
    expect(document.title).toBe('Deck'); // sem flash
  });

  it('faz flash do título quando a aba está escondida', () => {
    setVisibility('hidden');
    notifyTurnDone('sessão');
    expect(document.title).toBe('✦ Deck');
  });

  it('só restaura o flash quando a aba volta a ficar visível', () => {
    setVisibility('hidden');
    notifyTurnDone('sessão');
    expect(document.title).toBe('✦ Deck');

    // visibilitychange ainda escondida: NÃO restaura
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.title).toBe('✦ Deck');

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.title).toBe('Deck');
  });

  it('dispara Notification quando a permissão foi concedida', () => {
    setVisibility('hidden');
    const ctor = vi.fn();
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string, opts?: unknown) { ctor(title, opts); }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    notifyTurnDone('minha sessão');
    expect(ctor).toHaveBeenCalledWith('Deck — resposta pronta', expect.objectContaining({ body: 'minha sessão', tag: 'cockpit-done' }));
  });

  it('não dispara Notification sem permissão', () => {
    setVisibility('hidden');
    const ctor = vi.fn();
    class FakeNotification {
      static permission = 'denied';
      constructor(title: string) { ctor(title); }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    notifyTurnDone('sessão');
    expect(ctor).not.toHaveBeenCalled();
  });
});

describe('notifyTurnError', () => {
  beforeEach(() => {
    resetState();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('é no-op quando a aba está visível', () => {
    notifyTurnError('sessão', 'boom');
    expect(document.title).toBe('Deck');
  });

  it('faz flash e dispara Notification de erro escondido', () => {
    setVisibility('hidden');
    const ctor = vi.fn();
    class FakeNotification {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string, opts?: unknown) { ctor(title, opts); }
      close() {}
    }
    vi.stubGlobal('Notification', FakeNotification);
    notifyTurnError('sessão', 'overload');
    expect(document.title).toBe('✦ Deck');
    expect(ctor).toHaveBeenCalledWith('Deck — turno falhou', expect.objectContaining({ body: 'sessão — overload', tag: 'cockpit-error' }));
  });
});

describe('requestNotifyPermission', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pede permissão só quando o estado é default', () => {
    const req = vi.fn(() => Promise.resolve('granted'));
    class FakeNotification {
      static permission = 'default';
      static requestPermission = req;
    }
    vi.stubGlobal('Notification', FakeNotification);
    requestNotifyPermission();
    expect(req).toHaveBeenCalled();
  });

  it('não repede quando já concedida', () => {
    const req = vi.fn(() => Promise.resolve('granted'));
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = req;
    }
    vi.stubGlobal('Notification', FakeNotification);
    requestNotifyPermission();
    expect(req).not.toHaveBeenCalled();
  });
});

describe('setBadge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('é no-op quando o navegador não tem a API (aba comum, não PWA)', () => {
    vi.stubGlobal('navigator', {});
    expect(() => setBadge(3)).not.toThrow();
  });

  it('marca a contagem e limpa quando zera', () => {
    const setAppBadge = vi.fn(() => Promise.resolve());
    const clearAppBadge = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { setAppBadge, clearAppBadge });

    setBadge(2);
    expect(setAppBadge).toHaveBeenCalledWith(2);

    setBadge(0);
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('engole a promise rejeitada da API (permissão negada não pode quebrar o render)', () => {
    vi.stubGlobal('navigator', { setAppBadge: () => Promise.reject(new Error('denied')) });
    expect(() => setBadge(1)).not.toThrow();
  });
});

describe('vibração', () => {
  beforeEach(() => resetState());
  afterEach(() => vi.unstubAllGlobals());

  it('vibra curto no fim do turno em tela de toque', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    setPointer('coarse');
    setVisibility('hidden');
    notifyTurnDone('sessão');
    expect(vibrate).toHaveBeenCalledWith([30]);
  });

  it('usa padrão distinto no erro', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    setPointer('coarse');
    setVisibility('hidden');
    notifyTurnError('sessão', 'boom');
    expect(vibrate).toHaveBeenCalledWith([60, 40, 60]);
  });

  it('não vibra com ponteiro fino (desktop)', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    setPointer('fine');
    setVisibility('hidden');
    notifyTurnDone('sessão');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('não vibra com a aba visível', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    setPointer('coarse');
    notifyTurnDone('sessão');
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('som', () => {
  beforeEach(() => {
    resetState();
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function fakeAudio() {
    const ctor = vi.fn();
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      constructor() { ctor(); }
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {}, onended: null };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
      }
      close() { return Promise.resolve(); }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    return ctor;
  }

  it('não toca por padrão (preferência desligada)', () => {
    const ctor = fakeAudio();
    setVisibility('hidden');
    notifyTurnDone('sessão');
    expect(ctor).not.toHaveBeenCalled();
  });

  it('toca quando a preferência está ligada e a aba está escondida', () => {
    const ctor = fakeAudio();
    localStorage.setItem('cockpit:' + NOTIFY_SOUND_KEY, 'true');
    setVisibility('hidden');
    notifyTurnDone('sessão');
    expect(ctor).toHaveBeenCalled();
  });

  it('não toca com a aba visível mesmo com a preferência ligada', () => {
    const ctor = fakeAudio();
    localStorage.setItem('cockpit:' + NOTIFY_SOUND_KEY, 'true');
    notifyTurnDone('sessão');
    expect(ctor).not.toHaveBeenCalled();
  });
});
