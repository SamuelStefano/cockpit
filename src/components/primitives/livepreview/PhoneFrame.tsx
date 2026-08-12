import type { ReactNode } from 'react';

// Chassi de iPhone em volta da tela do preview nativo: notch, tela arredondada e
// indicador home. Só moldura — o conteúdo (iframe react-native-web) preenche a
// tela. Dimensões fixas (proporção ~iPhone) porque app nativo não tem "altura de
// conteúdo" como uma página web.
export const PHONE_SCREEN = { width: 300, height: 620 };

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center bg-neutral-950 py-5">
      <div className="relative rounded-[44px] border-[10px] border-neutral-800 bg-black shadow-2xl shadow-black/60"
        style={{ width: PHONE_SCREEN.width + 20, height: PHONE_SCREEN.height + 20 }}>
        <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
        <div className="h-full w-full overflow-hidden rounded-[34px] bg-white">{children}</div>
        <div className="absolute bottom-2 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-neutral-500/70" />
      </div>
    </div>
  );
}
