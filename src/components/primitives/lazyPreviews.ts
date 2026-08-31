import { lazy } from 'react';

// Os três previews são render CONDICIONAL do CodeBlock — só aparecem quando a fence
// tem uma linguagem de preview, `bench:` ou `sandbox`. Como eram import estático, o
// sucrase inteiro (transpilador do preview vivo) viajava no bundle inicial de todo
// mundo, inclusive de quem nunca abre um bloco desses.
export const LivePreview = lazy(() => import('./livepreview/LivePreview').then((m) => ({ default: m.LivePreview })));
export const BenchPreview = lazy(() => import('./livepreview/BenchPreview').then((m) => ({ default: m.BenchPreview })));
export const SandboxPreview = lazy(() => import('./livepreview/SandboxPreview').then((m) => ({ default: m.SandboxPreview })));
