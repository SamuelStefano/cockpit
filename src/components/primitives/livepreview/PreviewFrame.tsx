import type { ReactNode, RefObject } from 'react';
import { IFRAME_HTML } from './iframeHtml';
import { IFRAME_HTML_NATIVE } from './iframeHtmlNative';
import { IFRAME_HTML_SVG } from './iframeHtmlSvg';
import { IFRAME_HTML_TEST } from './iframeHtmlTest';
import { PhoneFrame, PHONE_SCREEN } from './PhoneFrame';
import type { Mode } from './useLivePreview';

const SRCDOC: Record<Mode, string> = {
  native: IFRAME_HTML_NATIVE,
  svg: IFRAME_HTML_SVG,
  test: IFRAME_HTML_TEST,
  html: IFRAME_HTML,
  react: IFRAME_HTML,
};

// Renderiza o iframe sandbox (origem opaca) e o envelope certo pro modo: telefone
// no nativo, coluna fluida ou moldura de largura fixa (viewport) no web. `width`
// só vale pro web — null = fluido (100%), número = moldura centralizada.
export function PreviewFrame({
  frameRef, mode, height, width, overlay, srcDoc, title = 'live preview', fill = false,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  mode: Mode;
  height: number;
  width: number | null;
  overlay?: ReactNode;
  /** Documento próprio (o bench tem o seu); sem isto vale o do modo. */
  srcDoc?: string;
  title?: string;
  /** Ocupa a altura do container em vez da altura medida do conteúdo. */
  fill?: boolean;
}) {
  const frame = (
    <iframe ref={frameRef} title={title} sandbox="allow-scripts" srcDoc={srcDoc ?? SRCDOC[mode]} />
  );

  if (mode === 'native') {
    return (
      <div className="relative">
        {overlay}
        <PhoneFrame>
          <div className="h-full w-full [&>iframe]:block [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
            style={{ width: PHONE_SCREEN.width, height: PHONE_SCREEN.height }}>
            {frame}
          </div>
        </PhoneFrame>
      </div>
    );
  }

  // Largura fixa: centraliza numa faixa neutra pra dar noção de dispositivo.
  if (width) {
    return (
      <div className="relative flex justify-center overflow-auto bg-neutral-950 py-4">
        {overlay}
        <div className="shrink-0 overflow-hidden rounded-md bg-white shadow-lg shadow-black/30 [&>div>iframe]:block [&>div>iframe]:w-full [&>div>iframe]:border-0"
          style={{ width }}>
          <div className="[&>iframe]:h-full" style={{ height }}>{frame}</div>
        </div>
      </div>
    );
  }

  // Em tela cheia a altura medida do conteúdo é teto, não alvo: a tela do repo
  // alvo costuma ser mais alta que o card e ficaria cortada de novo.
  const box = fill ? { height: '100%' } : { height };

  return (
    <div className={`relative bg-white ${fill ? 'h-full' : ''}`}>
      {overlay}
      <div className="[&>iframe]:block [&>iframe]:w-full [&>iframe]:border-0" style={box}>
        <div className="[&>iframe]:h-full" style={box}>{frame}</div>
      </div>
    </div>
  );
}
