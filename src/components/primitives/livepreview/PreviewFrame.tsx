import type { ReactNode, RefObject } from 'react';
import { IFRAME_HTML } from './iframeHtml';
import { IFRAME_HTML_NATIVE } from './iframeHtmlNative';
import { PhoneFrame, PHONE_SCREEN } from './PhoneFrame';
import type { Mode } from './useLivePreview';

// Renderiza o iframe sandbox (origem opaca) e o envelope certo pro modo: telefone
// no nativo, coluna fluida ou moldura de largura fixa (viewport) no web. `width`
// só vale pro web — null = fluido (100%), número = moldura centralizada.
export function PreviewFrame({
  frameRef, mode, height, width, overlay,
}: {
  frameRef: RefObject<HTMLIFrameElement>;
  mode: Mode;
  height: number;
  width: number | null;
  overlay?: ReactNode;
}) {
  const frame = (
    <iframe ref={frameRef} title="live preview" sandbox="allow-scripts"
      srcDoc={mode === 'native' ? IFRAME_HTML_NATIVE : IFRAME_HTML} />
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

  return (
    <div className="relative bg-white">
      {overlay}
      <div className="[&>iframe]:block [&>iframe]:w-full [&>iframe]:border-0" style={{ height }}>
        <div className="[&>iframe]:h-full" style={{ height }}>{frame}</div>
      </div>
    </div>
  );
}
