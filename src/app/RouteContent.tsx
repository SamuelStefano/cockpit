import { Suspense, useMemo, type ReactNode } from 'react';
import { MobileLayout } from '../components/Mobile';
import { DesktopLayout } from './DesktopLayout';
import { AgentCenter } from './AgentCenter';
import type { AgentNav } from './useAgentNav';
import { RouteFallback } from './RouteFallback';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';
import {
  Pontos,
  Graph, Canvas, DesignSystem, Onboarding, EquipePage, EquipeHome, Agente, Base, Arcade, Prs, Explorar,
} from './lazyRoutes';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import type { TerminalsPanelProps } from '../components/Terminals';
import type { Terminal } from '../data/types';
import type { useCockpit } from '../useCockpit';
import { AGENT_EXECUTOR, AGENT_MEETINGS, AGENT_STORE, type AgentTab, type Route } from '../useRoute';
import { SkeletonCards } from '../components/primitives';
import { AgentsHome } from '../routes/agentes-office/AgentsHome';
import { navigateTo } from '../lib/route-nav';
import { ChatPrDepsContext, type ChatPrDeps } from '../routes/prs/chat/pr-deps-context';

// The DFL snapshot is root-only on the server: the Canvas of a plain admin skips it.
const noop = () => {};

interface LayoutState {
  rowRef: React.RefObject<HTMLDivElement | null>;
}

interface MobileState {
  drawer: boolean;
  setDrawer: (v: boolean) => void;
  termSheet: boolean;
  setTermSheet: (v: boolean) => void;
  runningTerm: Terminal | undefined;
  drawerNav?: ReactNode;
}

interface RouteContentProps {
  route: Route;
  agentRoute?: { id: string; tab: AgentTab; open: (id: string, tab?: AgentTab) => void };
  isMobile: boolean;
  isAdmin: boolean;
  capsKnown: boolean;
  isRoot: boolean;
  connected: boolean;
  cockpit: ReturnType<typeof useCockpit>;
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  onOpenSession: (id: string) => void;
  agent: AgentNav;
  layout: LayoutState;
  mobile: MobileState;
}

export function RouteContent({ route, agentRoute, isMobile, isAdmin, capsKnown, isRoot, connected, cockpit, chatProps, termProps, onOpenSession, agent, layout, mobile }: RouteContentProps) {
  const c = cockpit;
  const { onSendTo, onLaunchAgent } = c;
  const prDeps = useMemo<ChatPrDeps | null>(
    () => (isRoot ? { onOpenSession, onSendTo, onLaunchAgent, connected, onAllPrs: () => navigateTo('/prs') } : null),
    [isRoot, connected, onOpenSession, onSendTo, onLaunchAgent],
  );
  const view = (() => {
    if (route === '/equipe/rotinas' || route === '/equipe/memoria' || route === '/equipe/mundo') {
      return (
        <EquipePage
          tab={route === '/equipe/memoria' ? 'memoria' : route === '/equipe/mundo' ? 'mundo' : 'rotinas'}
          teamState={c.teamState} onTeamStateGet={c.onTeamStateGet} meetings={c.meetings} onMeetingsGet={c.onMeetingsGet} onMeetingStart={c.onMeetingStart} teamPaused={c.teamPaused} onTeamPauseSet={c.onTeamPauseSet}
          memory={{ memories: c.memories, loaded: c.memoriesLoaded, onList: c.onMemList, onSave: c.onMemSave, onDelete: c.onMemDelete }}
          views={agent.views} connected={connected} isAdmin={isAdmin} capsKnown={capsKnown}
          bots={c.bots} onOpenChat={agent.open}
          cron={{ crons: c.crons, loaded: c.cronsLoaded, onCronsGet: c.onCronsGet, onCronSave: c.onCronSave, onCronDelete: c.onCronDelete, onCronRun: c.onCronRun }}
          onGo={navigateTo} />
      );
    }
    if (route === '/equipe' && isAdmin) {
      return (
        <EquipeHome state={c.teamState} bots={c.bots} connected={connected} onLoad={c.onTeamStateGet}
          onOpenAgent={agent.open} onSendTo={c.onSendTo} />
      );
    }
    if (route === '/arcade') return <Arcade />;
    if (route === '/explorar' && isAdmin) return <Explorar role={isRoot ? 'root' : 'admin'} onOpen={navigateTo} />;
    if (route === '/prs' && isRoot) {
      return <Prs role="root" connected={connected} onOpenSession={onOpenSession} onSendTo={c.onSendTo} onLaunchAgent={c.onLaunchAgent} />;
    }
    if (route === '/pontos' && isRoot) {
      return (
        <Pontos role="root" connected={connected} points={c.points} total={c.pointsTotal} loaded={c.pointsLoaded}
          onPointsGet={c.onPointsGet} onPointsAdd={c.onPointsAdd} onPointsCorrect={c.onPointsCorrect}
          onPointsNote={c.onPointsNote} onPointsDelete={c.onPointsDelete}
          dflSnapshot={c.dflSnapshot} dflLoaded={c.dflLoaded} dflSyncing={c.dflSyncing}
          onDflGet={c.onDflGet} onDflSync={c.onDflSync} onDflChange={c.onDflChange} onDflInvoice={c.onDflInvoice}
          onPontosAgent={c.onPontosAgent}
          drafts={c.drafts} draftsLoaded={c.draftsLoaded} onDraftsGet={c.onDraftsGet} onDraftOp={c.onDraftOp} />
      );
    }
    if (route === '/graph' && isAdmin) {
      return (
        <Graph connected={connected} graphs={c.graphs} loaded={c.graphsLoaded} openId={c.graphOpenId} opening={c.graphOpening} graph={c.graphData}
          building={c.graphBuilding} buildLog={c.graphBuildLog} buildError={c.graphBuildError} querying={c.graphQuerying} queryResult={c.graphQueryResult} queryHistory={c.graphQueryHistory}
          onGraphList={c.onGraphList} onGraphOpen={c.onGraphOpen} onGraphBuild={c.onGraphBuild} onClearBuildError={c.onClearBuildError} onGraphDelete={c.onGraphDelete} onGraphQuery={c.onGraphQuery} onGraphNodeOp={c.onGraphNodeOp} />
      );
    }
    if (route === '/base' && isAdmin) {
      return (
        <Base source={{
          connected, sessions: c.sessions, running: c.runningAnywhere, termStats: c.canvasTermStats, threads: c.threads, peeks: c.sessionPeeks, todos: c.allSessionTodos, bgAgents: c.allBgAgents,
          teamQuestions: c.pendingQuestions, graph: c.canvasGraph, board: c.canvasBoard, boardLoaded: c.canvasGraph !== null,
          stats: c.stats, crons: c.cronsLoaded ? c.crons : null, mcpServers: c.mcpServers.length ? c.mcpServers : null, bots: c.bots,
          onCtxStats: c.onCanvasCtxStats, onPeek: c.onSessionPeek, onLoadThread: c.onLoadThread, onCanvasGet: c.onCanvasGet, onCanvasCardSave: c.onCanvasCardSave, onCronsGet: c.onCronsGet,
          onSendTo: c.onSendTo, onStop: c.onStop, onOpenSession,
        }} />
      );
    }
    if (route === '/canvas' && isAdmin) {
      return (
        <Canvas role={isRoot ? 'root' : 'admin'} connected={connected} graph={c.canvasGraph} board={c.canvasBoard} loading={c.canvasLoading}
          loadingSince={c.canvasLoadingSince} stale={c.canvasStale} sessions={c.sessions} running={c.running} runStart={c.runStart}
          onCanvasGet={c.onCanvasGet} onCanvasPos={c.onCanvasPos} onCanvasPosReset={c.onCanvasPosReset}
          onCanvasCardSave={c.onCanvasCardSave} onCanvasCardDelete={c.onCanvasCardDelete} onCanvasBudgetSave={c.onCanvasBudgetSave}
          onCanvasSessionStatus={c.onCanvasSessionStatus} onCanvasSessionStatusBulk={c.onCanvasSessionStatusBulk}
          onHideSession={c.onCanvasHideSession} onUnhideAllSessions={c.onCanvasUnhideAllSessions}
          onCanvasFlowSave={c.onCanvasFlowSave} onCanvasFlowDelete={c.onCanvasFlowDelete} canvasFlowFired={c.canvasFlowFired}
          canvasFlowRuns={c.canvasFlowRuns}
          onLaunchAgent={c.onLaunchAgent} onOpenSession={onOpenSession} onSendTo={c.onSendTo}
          canvasSendError={c.canvasSendError} dismissCanvasSendError={c.dismissCanvasSendError}
          onLaunchFork={c.onLaunchFork} canvasForkRuns={c.canvasForkRuns} pendingSessionIds={c.pendingSessionIds}
          term={c.term} discoveredTerms={c.discoveredTerms} listTerms={c.listTerms}
          termStats={c.canvasTermStats} onTermStats={c.onCanvasTermStats} onCanvasCtxStats={c.onCanvasCtxStats}
          areaUsage={c.canvasAreaUsage} interrupted={c.interrupted}
          dflSnapshot={c.dflSnapshot} onDflGet={isRoot ? c.onDflGet : noop}
          onDflTaskLink={c.onDflTaskLink} onDflTaskCreateLink={c.onDflTaskCreateLink} onDflTaskUnlink={c.onDflTaskUnlink}
          onDflTaskConfirmSync={c.onDflTaskConfirmSync}
          cvLiveSessionIds={c.cvLiveSessionIds} cvIdleSessionIds={c.cvIdleSessionIds} sessionPeeks={c.sessionPeeks} onSessionPeek={c.onSessionPeek} />
      );
    }
    if (route === '/agentes' && agentRoute && (!agentRoute.id || agentRoute.id === AGENT_STORE || agentRoute.id === AGENT_MEETINGS || agentRoute.id === AGENT_EXECUTOR)) {
      return (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-350 px-4 pb-8 pt-6 max-lg:pt-2 sm:px-8">
            {c.teamLoaded
              ? <AgentsHome tab={agentRoute.id === AGENT_MEETINGS ? 'reunioes' : agentRoute.id === AGENT_EXECUTOR ? 'executor' : agentRoute.id ? 'loja' : 'escritorio'}
                  onTab={(t) => agentRoute.open(t === 'loja' ? AGENT_STORE : t === 'reunioes' ? AGENT_MEETINGS : t === 'executor' ? AGENT_EXECUTOR : '')}
                  meetings={c.meetings} onMeetingsGet={c.onMeetingsGet} onMeetingStart={c.onMeetingStart}
                  executor={c.executor} heavyJobs={c.heavyJobs} onHeavyGet={c.onHeavyGet} onHeavyRun={c.onHeavyRun} onHeavyCancel={c.onHeavyCancel}
                  views={agent.views} bots={c.bots} skills={c.skills} connected={connected} canEdit={isAdmin} onSkillList={c.onSkillList}
                  onSave={c.onTeamSave} onOpen={agent.open} onProfile={(id) => agentRoute.open(id)} onNew={agent.openNew} />
              : <SkeletonCards />}
          </div>
        </div>
      );
    }
    if (route === '/agentes' && agentRoute) {
      return (
        <Agente agentId={agentRoute.id} tab={agentRoute.tab} views={agent.views} api={c} connected={connected} isAdmin={isAdmin} isMobile={isMobile}
          onTab={agentRoute.open} onList={() => agentRoute.open('')} onChat={agent.open} />
      );
    }
    if (route === '/ds') return <DesignSystem />;
    if (route === '/onboarding') {
      return (
        <Onboarding agents={c.agents} claudeImport={isRoot ? c.claudeImport : undefined} byoKeys={isRoot} claudeReady={c.claudeReady} login={c.claudeLogin}
          onStart={c.onClaudeLoginStart} onCode={c.onClaudeLoginCode} onCancel={c.onClaudeLoginCancel}
          onDone={() => navigateTo('/')} connected={connected} />
      );
    }
    // '/' is the default agent's chat; the header picker switches agents.
    const center = agent.active
      ? <AgentCenter view={agent.active} agent={agent} cockpit={c} chatProps={chatProps} connected={connected} isMobile={isMobile} isAdmin={isAdmin} />
      : undefined;
    if (isMobile) {
      return (
        <MobileLayout
          chatProps={chatProps} termProps={termProps} center={center}
          drawer={mobile.drawer} setDrawer={mobile.setDrawer}
          termSheet={mobile.termSheet} setTermSheet={mobile.setTermSheet}
          runningTerm={mobile.runningTerm} drawerNav={mobile.drawerNav}
        />
      );
    }
    return (
      <DesktopLayout
        chatProps={chatProps} termProps={termProps} center={center} hideTerminals={agent.profileOpen}
        rowRef={layout.rowRef}
      />
    );
  })();

  // key={route} remonta o wrapper a cada troca de rota → a animação de entrada
  // roda de novo. As views já desmontavam na troca, então não há remontagem extra.
  //
  // O Suspense fica DENTRO do wrapper com key={route}: por fora, o fallback trocaria
  // o elemento que a animação de entrada usa como âncora e a rota piscaria duas vezes
  // (skeleton, fade, conteúdo). Os layouts de chat não são lazy, então o fallback só
  // aparece na primeira visita a uma rota.
  return (
    <div key={route} className="route-fade flex min-h-0 min-w-0 flex-1 flex-col">
      <ChunkErrorBoundary>
        <ChatPrDepsContext.Provider value={prDeps}>
          <Suspense fallback={<RouteFallback />}>{view}</Suspense>
        </ChatPrDepsContext.Provider>
      </ChunkErrorBoundary>
    </div>
  );
}
