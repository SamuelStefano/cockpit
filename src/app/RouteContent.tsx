import { Suspense, type ReactNode } from 'react';
import { MobileLayout } from '../components/Mobile';
import { DesktopLayout } from './DesktopLayout';
import { AgentCenter } from './AgentCenter';
import type { AgentNav } from './useAgentNav';
import { RouteFallback } from './RouteFallback';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';
import {
  Skills, Pontos, Crons, Observatorio,
  Graph, Canvas, Admin, Docs, DesignSystem, Onboarding, EquipePage, Agente,
} from './lazyRoutes';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import type { TerminalsPanelProps } from '../components/Terminals';
import type { Terminal } from '../data/types';
import type { useCockpit } from '../useCockpit';
import type { AgentTab, Route } from '../useRoute';
import { navigateTo } from '../lib/route-nav';

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
  skillRoute?: { id: string; open: (id: string) => void };
  agentRoute?: { id: string; tab: AgentTab; open: (id: string, tab?: AgentTab) => void };
  isMobile: boolean;
  isAdmin: boolean;
  isRoot: boolean;
  connected: boolean;
  cockpit: ReturnType<typeof useCockpit>;
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  onOpenSession: (id: string) => void;
  agent: AgentNav;
  onOpenAgentChat: (model: string) => void;
  layout: LayoutState;
  mobile: MobileState;
}

export function RouteContent({ route, agentRoute, skillRoute, isMobile, isAdmin, isRoot, connected, cockpit, chatProps, termProps, onOpenSession, agent, onOpenAgentChat, layout, mobile }: RouteContentProps) {
  const c = cockpit;
  const view = (() => {
    if (route === '/equipe' || route === '/equipe/memoria') {
      return (
        <EquipePage
          tab={route === '/equipe/memoria' ? 'memoria' : 'agentes'}
          memory={{ memories: c.memories, loaded: c.memoriesLoaded, onList: c.onMemList, onSave: c.onMemSave, onDelete: c.onMemDelete }}
          views={agent.views} connected={connected} isAdmin={isAdmin} usageStats={c.usageStats} paused={c.teamPaused}
          cronCount={c.cronsLoaded ? c.crons.length : undefined}
          onOpenAgent={(id) => agentRoute?.open(id)} onNew={agent.openNew} onPauseSet={c.onTeamPauseSet} onUsageList={c.onUsageList} onGo={navigateTo} />
      );
    }
    if (route === '/skills') {
      return (
        <Skills connected={connected} skills={c.skills} loaded={c.skillsLoaded} openSkill={c.openSkill} bots={c.bots}
          skillId={skillRoute?.id ?? ''} onNavigate={(id) => skillRoute?.open(id)}
          registry={c.registry} registryLoading={c.registryLoading} registryError={c.registryError} installing={c.installing}
          onSkillList={c.onSkillList} onSkillOpen={c.onSkillOpen} onSkillClose={c.onSkillClose}
          onRegistryGet={c.onRegistryGet} onRegistryInstall={c.onRegistryInstall} />
      );
    }
    if (route === '/pontos' && isRoot) {
      return (
        <Pontos connected={connected} points={c.points} total={c.pointsTotal} loaded={c.pointsLoaded}
          onPointsGet={c.onPointsGet} onPointsAdd={c.onPointsAdd} onPointsCorrect={c.onPointsCorrect}
          onPointsNote={c.onPointsNote} onPointsDelete={c.onPointsDelete}
          dflSnapshot={c.dflSnapshot} dflLoaded={c.dflLoaded} dflSyncing={c.dflSyncing}
          onDflGet={c.onDflGet} onDflSync={c.onDflSync} onDflChange={c.onDflChange} onDflInvoice={c.onDflInvoice}
          onPontosAgent={c.onPontosAgent}
          drafts={c.drafts} draftsLoaded={c.draftsLoaded} onDraftsGet={c.onDraftsGet} onDraftOp={c.onDraftOp} />
      );
    }
    if (route === '/crons') {
      return (
        <Crons connected={connected} crons={c.crons} loaded={c.cronsLoaded}
          onCronsGet={c.onCronsGet} onCronSave={c.onCronSave} onCronDelete={c.onCronDelete} onCronRun={c.onCronRun}
          planUsage={c.planUsage} models={c.models} bots={c.bots} onTeamGet={c.onTeamGet} />
      );
    }
    if (route === '/uso') {
      return (
        <Observatorio connected={connected} usageStats={c.usageStats} onUsageList={c.onUsageList} sessions={c.sessions} rate={c.rate}
          onOpenSession={onOpenSession} />
      );
    }
    if (route === '/graph' && isAdmin) {
      return (
        <Graph connected={connected} graphs={c.graphs} loaded={c.graphsLoaded} openId={c.graphOpenId} opening={c.graphOpening} graph={c.graphData}
          building={c.graphBuilding} buildLog={c.graphBuildLog} buildError={c.graphBuildError} querying={c.graphQuerying} queryResult={c.graphQueryResult} queryHistory={c.graphQueryHistory}
          onGraphList={c.onGraphList} onGraphOpen={c.onGraphOpen} onGraphBuild={c.onGraphBuild} onClearBuildError={c.onClearBuildError} onGraphDelete={c.onGraphDelete} onGraphQuery={c.onGraphQuery} onGraphNodeOp={c.onGraphNodeOp} />
      );
    }
    if (route === '/canvas' && isAdmin) {
      return (
        <Canvas connected={connected} graph={c.canvasGraph} board={c.canvasBoard} loading={c.canvasLoading}
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
          orchestratorActivity={c.orchestratorActivity} onOrchestratorActivityGet={c.onOrchestratorActivityGet}
          cvLiveSessionIds={c.cvLiveSessionIds} cvIdleSessionIds={c.cvIdleSessionIds} sessionPeeks={c.sessionPeeks} onSessionPeek={c.onSessionPeek} />
      );
    }
    if (route === '/painel' && isAdmin) {
      return (
        <Admin health={c.health} stats={c.stats} onHealthList={c.onHealthList}
          accounts={c.accounts} accountsLoaded={c.accountsLoaded} onAccountsList={c.onAccountsList} onSetAdmin={c.onSetAdmin} isRoot={isRoot}
          adminOp={c.adminOp} onEnvSet={c.onEnvSet} onEnvUnset={c.onEnvUnset} onMcpAdd={c.onMcpAdd} onMcpRemove={c.onMcpRemove} onCliInstall={c.onCliInstall}
          onCliUpdate={c.onCliUpdate} onDeckRestart={c.onDeckRestart} agents={c.agents} dflMcps={c} term={c.term} models={c.models} onOpenAgentChat={onOpenAgentChat} />
      );
    }
    if (route === '/agentes' && agentRoute) {
      return (
        <Agente agentId={agentRoute.id} tab={agentRoute.tab} views={agent.views} api={c} connected={connected} isAdmin={isAdmin} isMobile={isMobile}
          onTab={agentRoute.open} onList={() => agentRoute.open('')} onChat={agent.open} />
      );
    }
    if (route === '/docs') return <Docs />;
    if (route === '/ds') return <DesignSystem />;
    if (route === '/onboarding') {
      return (
        <Onboarding agents={c.agents} claudeReady={c.claudeReady} login={c.claudeLogin}
          onStart={c.onClaudeLoginStart} onCode={c.onClaudeLoginCode} onCancel={c.onClaudeLoginCancel}
          onDone={() => navigateTo('/')} />
      );
    }
    // '/' and '/equipe' (a deep link that lands on the primary agent) share one surface.
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
        <Suspense fallback={<RouteFallback />}>{view}</Suspense>
      </ChunkErrorBoundary>
    </div>
  );
}
