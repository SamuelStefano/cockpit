import { useCallback, useEffect, useState } from 'react';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Text-to-speech via Web Speech API (custo zero, roda no browser). toggle() fala o
// texto em pt-BR; chamar de novo enquanto fala interrompe. Cancela ao desmontar
// (trocar de sessão não deixa a voz seguir falando).
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, []);

  const toggle = useCallback((text: string) => {
    if (!supported) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }, []);

  return { supported, speaking, toggle };
}
