import { MobileLayout } from '../components/Mobile';
import { DesktopLayout } from './DesktopLayout';
import { Contextos } from '../routes/Contextos';
import { Skills } from '../routes/Skills';
import { Notas } from '../routes/Notas';
import { Crons } from '../routes/Crons';
import { Observatorio } from '../routes/Observatorio';
import { Admin } from '../routes/Admin';
import { Docs } from '../routes/Docs';
import { DesignSystem } from '../routes/DesignSystem';
import type { SessionsPanelProps } from '../components/Sessions';
import type { ChatPanelProps } from '../components/Chat';
import type { TerminalsPanelProps } from '../components/Terminals';
import type { Terminal } from '../data/mock';
import type { useCockpit } from '../useCockpit';
import type { Route } from '../useRoute';

interface LayoutState {
  rowRef: React.RefObject<HTMLDivElement>;
  leftW: number;
  rightW: number;
  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;
  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;
  startDrag: (which: string) => (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface MobileState {
  drawer: boolean;
  setDrawer: (v: boolean) => void;
  termSheet: boolean;
  setTermSheet: (v: boolean) => void;
  runningTerm: Terminal | undefined;
}

interface RouteContentProps {
  route: Route;
  isMobile: boolean;
  isAdmin: boolean;
  connected: boolean;
  cockpit: ReturnType<typeof useCockpit>;
  sessionsProps: SessionsPanelProps;
  chatProps: ChatPanelProps;
  termProps: TerminalsPanelProps;
  onOpenSession: (id: string) => void;
  onAnalyzeNotes: (text: string) => void;
  layout: LayoutState;
  mobile: MobileState;
}

export function RouteContent({ route, isMobile, isAdmin, connected, cockpit, sessionsProps, chatProps, termProps, onOpenSession, onAnalyzeNotes, layout, mobile }: RouteContentProps) {
  const c = cockpit;
  const view = (() => {
    if (route === '/contextos') {
      return (
        <Contextos connected={connected} contexts={c.contexts} loaded={c.ctxLoaded} openContext={c.openContext}
          onCtxList={c.onCtxList} onCtxOpen={c.onCtxOpen} onCtxClose={c.onCtxClose} />
      );
    }
    if (route === '/skills') {
      return (
        <Skills connected={connected} skills={c.skills} loaded={c.skillsLoaded} openSkill={c.openSkill}
          onSkillList={c.onSkillList} onSkillOpen={c.onSkillOpen} onSkillClose={c.onSkillClose} />
      );
    }
    if (route === '/notas') {
      return (
        <Notas connected={connected} notes={c.notes} notesLoaded={c.notesLoaded}
          onNotesGet={c.onNotesGet} onNotesSave={c.onNotesSave} onAnalyze={onAnalyzeNotes} />
      );
    }
    if (route === '/crons') {
      return (
        <Crons connected={connected} crons={c.crons}
          onCronsGet={c.onCronsGet} onCronSave={c.onCronSave} onCronDelete={c.onCronDelete} onCronRun={c.onCronRun} />
      );
    }
    if (route === '/uso') {
      return (
        <Observatorio connected={connected} usageStats={c.usageStats} onUsageList={c.onUsageList} sessions={c.sessions} rate={c.rate}
          onOpenSession={onOpenSession} />
      );
    }
    if (route === '/admin' && isAdmin) {
      return (
        <Admin health={c.health} stats={c.stats} onHealthList={c.onHealthList}
          accounts={c.accounts} onAccountsList={c.onAccountsList} onSetAdmin={c.onSetAdmin} isRoot={c.caps?.role === 'root'}
          adminOp={c.adminOp} onEnvSet={c.onEnvSet} onEnvUnset={c.onEnvUnset} onMcpAdd={c.onMcpAdd} onMcpRemove={c.onMcpRemove} onCliInstall={c.onCliInstall} />
      );
    }
    if (route === '/docs') return <Docs />;
    if (route === '/ds') return <DesignSystem />;
    if (isMobile) {
      return (
        <MobileLayout
          sessionsProps={sessionsProps} chatProps={chatProps} termProps={termProps}
          drawer={mobile.drawer} setDrawer={mobile.setDrawer}
          termSheet={mobile.termSheet} setTermSheet={mobile.setTermSheet}
          runningTerm={mobile.runningTerm}
        />
      );
    }
    return (
      <DesktopLayout
        sessionsProps={sessionsProps} chatProps={chatProps} termProps={termProps}
        rowRef={layout.rowRef} leftW={layout.leftW} rightW={layout.rightW}
        leftCollapsed={layout.leftCollapsed} setLeftCollapsed={layout.setLeftCollapsed}
        rightCollapsed={layout.rightCollapsed} setRightCollapsed={layout.setRightCollapsed}
        startDrag={layout.startDrag}
      />
    );
  })();

  // key={route} remonta o wrapper a cada troca de rota → a animação de entrada
  // roda de novo. As views já desmontavam na troca, então não há remontagem extra.
  return (
    <div key={route} className="route-fade flex min-h-0 min-w-0 flex-1 flex-col">
      {view}
    </div>
  );
}
