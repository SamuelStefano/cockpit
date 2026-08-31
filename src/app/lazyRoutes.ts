import { lazy } from 'react';

// As 13 rotas eram `import` estático no RouteContent, então TODAS entravam no bundle
// inicial: quem abre o chat baixava o Playground, o Observatório, o /ds e o Admin
// antes de ver a primeira mensagem. Separar por manualChunks não resolveria — aquilo
// divide o ARQUIVO, não o carregamento; só o `import()` tira o módulo do caminho
// crítico.
//
// As rotas exportam nomeado (o padrão do repo), e o React.lazy exige `default` —
// daí o `.then` em cada uma.
export const Contextos = lazy(() => import('../routes/Contextos').then((m) => ({ default: m.Contextos })));
export const Skills = lazy(() => import('../routes/Skills').then((m) => ({ default: m.Skills })));
export const Notas = lazy(() => import('../routes/Notas').then((m) => ({ default: m.Notas })));
export const Pontos = lazy(() => import('../routes/Pontos').then((m) => ({ default: m.Pontos })));
export const Crons = lazy(() => import('../routes/Crons').then((m) => ({ default: m.Crons })));
export const Observatorio = lazy(() => import('../routes/Observatorio').then((m) => ({ default: m.Observatorio })));
export const Graph = lazy(() => import('../routes/Graph').then((m) => ({ default: m.Graph })));
export const Harness = lazy(() => import('../routes/Harness').then((m) => ({ default: m.Harness })));
export const Admin = lazy(() => import('../routes/Admin').then((m) => ({ default: m.Admin })));
export const Docs = lazy(() => import('../routes/Docs').then((m) => ({ default: m.Docs })));
export const DesignSystem = lazy(() => import('../routes/DesignSystem').then((m) => ({ default: m.DesignSystem })));
export const Playground = lazy(() => import('../routes/Playground').then((m) => ({ default: m.Playground })));
