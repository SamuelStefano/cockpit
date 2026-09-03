// Fatia do useSpeechInput que os botões do composer consomem. Estava duplicada em
// cada botão que recebe o mic.
export interface Mic {
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
}
