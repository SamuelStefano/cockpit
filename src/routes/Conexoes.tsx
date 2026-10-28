import { useEffect, useMemo, useState } from 'react';
import type { Connection } from '../../shared/connections';
import type { TeamBot } from '../../shared/protocol';
import { Button, Modal, Tabs, type TabItem } from '../components/primitives';
import { useSealState } from '../components/auth/useEnrollDevice';
import { useDevices } from '../cockpit/useDevices';
import { useDeviceLink } from '../components/profile/useDeviceLink';
import { ConnectionRow, ROW_GRID } from './conexoes/ConnectionRow';
import { ConnectTool } from './conexoes/ConnectTool';
import { EmptyTab } from './conexoes/EmptyTab';
import { Notice } from './conexoes/Notice';
import { PairDevice } from './conexoes/PairDevice';
import {
  itemsOf, noticeOf, problems, tabOfKind, TAB_HEAD, TAB_LABEL, toolHost, visibleTabs, type ConnTab,
} from './conexoes/connection-view';
import type { RowAction } from './conexoes/connection-view';

interface Props {
  connected: boolean;
  items: Connection[];
  loaded: boolean;
  bots: TeamBot[];
  dflMcpsState: unknown;
  dflMcpsBusy: boolean;
  onGet: () => void;
  onToolAdd: (hosts?: string[]) => void;
  onGo: (to: '/onboarding') => void;
}

const FOOT: Partial<Record<ConnTab, string>> = {
  provedores: 'Claude, OpenAI, Gemini, Grok, Z.AI, DeepSeek, Mistral, OpenRouter, Ollama… ou qualquer endereço compatível com OpenAI',
  ferramentas: 'GitHub, Gmail, Drive, Slack, Notion, WhatsApp… ou o endereço de um servidor',
  maquinas: 'Outra VPS ou computador com o Deck instalado. Os agentes de cada máquina aparecem agrupados na barra lateral.',
};

export function Conexoes({ connected, items, loaded, bots, dflMcpsState, dflMcpsBusy, onGet, onToolAdd, onGo }: Props) {
  const [tab, setTab] = useState<ConnTab>(() => (location.hash === '#aparelhos' ? 'aparelhos' : 'provedores'));
  const [toolOpen, setToolOpen] = useState(false);
  const [removing, setRemoving] = useState<Connection | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sealed = useSealState() === 'sealed';
  const devices = useDevices(sealed);
  const link = useDeviceLink();

  useEffect(() => { if (connected) onGet(); }, [connected, onGet]);
  useEffect(() => { if (dflMcpsState) onGet(); }, [dflMcpsState, onGet]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const tabs = useMemo(() => visibleTabs(items), [items]);
  const active: ConnTab = tabs.includes(tab) ? tab : 'provedores';
  const list = itemsOf(items, active);
  const notice = noticeOf(items, bots);
  const canConnect = active === 'provedores' || active === 'ferramentas' || (active === 'aparelhos' && sealed);

  const tabItems: TabItem<ConnTab>[] = tabs.map((t) => ({ id: t, label: TAB_LABEL[t], count: loaded ? itemsOf(items, t).length : undefined }));

  const connectFlow = () => {
    if (active === 'provedores') onGo('/onboarding');
    else if (active === 'ferramentas') setToolOpen(true);
    else if (active === 'aparelhos') link.start();
  };

  const resolve = () => {
    const first = problems(items)[0];
    if (!first) return;
    setTab(tabOfKind(first.kind));
    requestAnimationFrame(() => document.getElementById(`conn-${first.id}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }));
  };

  const onAction = (a: RowAction, c: Connection) => {
    if (a.kind === 'remove') { setRemoving(c); return; }
    if (c.kind === 'tool') onToolAdd([toolHost(c)]);
    else if (c.kind === 'provider') onGo('/onboarding');
  };

  const confirmRemove = () => {
    const pub = devices.items?.find((d) => removing && `device:${d.pub.slice(0, 8)}` === removing.id)?.pub;
    if (pub) devices.revoke(pub);
    setRemoving(null);
    setTimeout(onGet, 400);
  };

  const canRemove = (c: Connection) => !!devices.items?.some((d) => `device:${d.pub.slice(0, 8)}` === c.id && !d.current);
  const head = TAB_HEAD[active];

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1000px] p-4 md:p-8">
        <header className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-neutral-100">Conexões</h1>
          <p className="text-[13px] text-neutral-500">Tudo que o Deck usa de fora e como está agora.</p>
          {canConnect && <Button size="sm" icon="plus" className="ml-auto" onClick={connectFlow}>Conectar</Button>}
        </header>
        <Tabs items={tabItems} active={active} onChange={setTab} className="mb-5" />
        {notice && <Notice {...notice} onResolve={resolve} />}
        {!loaded ? (
          <p className="py-10 text-center text-[13px] text-neutral-500">carregando…</p>
        ) : list.length === 0 ? (
          <EmptyTab tab={active} onConnect={canConnect ? connectFlow : undefined} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
            <div className={`hidden px-4 py-2 text-[11.5px] font-medium text-neutral-500 ${ROW_GRID}`}>
              <span /><span>{head[0]}</span><span>{head[1]}</span><span>{head[2]}</span><span>{head[3]}</span><span />
            </div>
            {list.map((c) => (
              <ConnectionRow key={c.id} c={c} bots={bots} now={now} busy={dflMcpsBusy}
                deviceBadge={c.detail === 'esta máquina' ? 'esta' : undefined}
                onAction={(a, row) => onAction(a, row)} canAct={c.kind !== 'device' || canRemove(c)} />
            ))}
            {FOOT[active] && <div className="border-t border-neutral-800 px-4 py-3 text-[12.5px] text-neutral-500">{FOOT[active]}</div>}
          </div>
        )}
        {active === 'ferramentas' && list.length > 0 && (
          <p className="mt-3 text-[12px] text-neutral-500">Cada agente só usa as ferramentas que estão ligadas na página dele. Desligar aqui desliga para todos.</p>
        )}
        {active === 'aparelhos' && sealed && <PairDevice link={link} />}
      </div>
      <ConnectTool open={toolOpen} busy={dflMcpsBusy} onClose={() => setToolOpen(false)} onConnect={() => { onToolAdd(); setToolOpen(false); }} />
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remover aparelho?" icon="smartphone" maxWidth="max-w-sm">
        <p className="text-[13px] leading-relaxed text-neutral-400">{removing?.label} perde o acesso agora e precisa ser pareado de novo para voltar.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoving(null)}>Cancelar</Button>
          <Button variant="dangerSolid" onClick={confirmRemove}>Remover</Button>
        </div>
      </Modal>
    </div>
  );
}
