import { lazy } from 'react';

// As 13 rotas eram `import` estático no RouteContent, então TODAS entravam no bundle
// inicial: quem abre o chat baixava o Observatório, o /ds e o Painel
// antes de ver a primeira mensagem. Separar por manualChunks não resolveria — aquilo
// divide o ARQUIVO, não o carregamento; só o `import()` tira o módulo do caminho
// crítico.
//
// As rotas exportam nomeado (o padrão do repo), e o React.lazy exige `default` —
// daí o `.then` em cada uma.
export const Contextos = lazy(() => import('../routes/Contextos').then((m) => ({ default: m.Contextos })));
export const Skills = lazy(() => import('../routes/Skills').then((m) => ({ default: m.Skills })));
export const Pontos = lazy(() => import('../routes/Pontos').then((m) => ({ default: m.Pontos })));
export const Equipe = lazy(() => import('../routes/Equipe').then((m) => ({ default: m.Equipe })));
export const EquipePage = lazy(() => import('../routes/EquipePage').then((m) => ({ default: m.EquipePage })));
export const Crons = lazy(() => import('../routes/Crons').then((m) => ({ default: m.Crons })));
export const Observatorio = lazy(() => import('../routes/Observatorio').then((m) => ({ default: m.Observatorio })));
export const Canvas = lazy(() => import('../routes/Canvas').then((m) => ({ default: m.Canvas })));
export const Graph = lazy(() => import('../routes/Graph').then((m) => ({ default: m.Graph })));
export const Admin = lazy(() => import('../routes/Admin').then((m) => ({ default: m.Admin })));
export const Docs = lazy(() => import('../routes/Docs').then((m) => ({ default: m.Docs })));
export const DesignSystem = lazy(() => import('../routes/DesignSystem').then((m) => ({ default: m.DesignSystem })));
export const Agente = lazy(() => import('../routes/Agente').then((m) => ({ default: m.Agente })));
export const Onboarding = lazy(() => import('../routes/Onboarding').then((m) => ({ default: m.Onboarding })));
