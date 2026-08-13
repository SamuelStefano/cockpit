import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';
import { broadcast, send } from './broadcast';
import {
  addCustomProvider, allProviders, onRouteChange, removeCustomProvider,
  routesView, setActiveRoute, setOverride, setRoutingEnabled,
} from '../router/state';

// Borda WS do roteador: traduz as mensagens de admin e avisa os clientes quando a
// rota troca sozinha. O estado mora no router/; aqui só entra o que precisa de
// socket — é o que mantém o router/ puro o bastante pra testar sem servidor.

type RouteMsg = Extract<ClientMsg, { t: `route${string}` }>;

export function handleRouteMsg(ws: WebSocket, msg: RouteMsg): void {
  switch (msg.t) {
    case 'routes-get':
      return send(ws, { t: 'routes', snapshot: routesView() });
    case 'routes-enable':
      setRoutingEnabled(!!msg.on);
      return reply(ws, { ok: true, message: msg.on ? 'roteamento ligado' : 'roteamento desligado' });
    case 'route-set':
      return reply(ws, setActiveRoute(String(msg.id)));
    case 'route-config':
      return reply(ws, setOverride(String(msg.id), { enabled: msg.enabled, priority: msg.priority }));
    case 'route-custom-add':
      return reply(ws, addCustomProvider({
        id: String(msg.id), label: msg.label, baseUrl: String(msg.baseUrl), authEnv: msg.authEnv,
        authMode: msg.authMode, model: String(msg.model), smallModel: msg.smallModel, priority: msg.priority,
      }));
    case 'route-custom-remove':
      return reply(ws, removeCustomProvider(String(msg.id)));
  }
}

// Toda resposta reemite o snapshot: a UI nunca precisa adivinhar o efeito do
// comando nem manter estado espelhado do servidor.
function reply(ws: WebSocket, r: { ok: boolean; message: string }): void {
  send(ws, { t: 'admin-op', ok: r.ok, message: r.message });
  broadcastRoutes();
}

export function broadcastRoutes(): void {
  broadcast({ t: 'routes', snapshot: routesView() });
}

// Troca automática: além do snapshot, um evento próprio pro cliente conseguir
// avisar o usuário ("caiu pro Z.AI porque o plano esgotou") sem diffar listas.
export function startRouteBroadcast(): void {
  onRouteChange((change) => {
    const label = allProviders().find((p) => p.id === change.to)?.label ?? change.to;
    broadcast({ t: 'route-switch', from: change.from, to: change.to, label, reason: change.reason, kind: change.kind, until: change.until });
    broadcastRoutes();
  });
}
