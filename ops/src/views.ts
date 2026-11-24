import type { AgentRow, DiagReport } from './data.ts';
import { esc, href, html, Html } from './html.ts';
import { summarize } from './summary.ts';
import { ago, brt } from './time.ts';

export interface Health { ok: boolean; text: string }

function layout(title: string, health: Health | null, body: Html): string {
  const head = health
    ? html`<header><strong>deck-ops</strong><nav><a href="/reports">Relatórios</a><a href="/boxes">Boxes</a></nav>
<span class="health">saúde: <span class="${health.ok ? 'ok' : 'bad'}">${health.text}</span></span>
<form method="post" action="/logout"><button type="submit">Sair</button></form></header>`
    : html``;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="same-origin"><title>${esc(title)} · deck-ops</title><link rel="stylesheet" href="/ops.css"></head><body>${head}<main>${body}</main></body></html>`;
}

export function loginPage(error: string | null): string {
  return layout('Entrar', null, html`<form class="login" method="post" action="/login">
<h1>deck-ops</h1>
${error ? html`<p class="err">${error}</p>` : ''}
<input name="email" type="email" autocomplete="username" placeholder="email" required>
<input name="password" type="password" autocomplete="current-password" placeholder="senha" required>
<button class="primary" type="submit">Entrar</button></form>`);
}

const when = (iso: string | null, now: number) => html`<span title="${brt(iso)}">${ago(iso, now)}</span><br><span class="dim">${brt(iso)}</span>`;

export interface ReportsView {
  rows: DiagReport[];
  emails: Map<string, string>;
  labels: Map<string, string>;
  filters: { email?: string; source?: string; kind?: string; box?: string };
  now: number;
  health: Health;
}

export function reportsPage(v: ReportsView): string {
  const f = v.filters;
  const opt = (val: string, label: string) => html`<option value="${val}"${new Html(f.source === val ? ' selected' : '')}>${label}</option>`;
  const rows = v.rows.map((r) => html`<tr>
<td>${when(r.created_at, v.now)}</td>
<td>${v.emails.get(r.account_id) || r.account_id}</td>
<td>${r.source}</td>
<td><a href="${href(`/reports/${r.id}`)}">${r.kind}</a></td>
<td>${r.box_id ? v.labels.get(r.box_id) || r.box_id : '—'}</td>
<td class="wrap">${summarize(r)}</td></tr>`);
  return layout('Relatórios', v.health, html`<h1>Relatórios de diagnóstico</h1>
<form class="filters" method="get" action="/reports">
<input name="email" placeholder="email da conta" value="${f.email ?? ''}">
<select name="source"><option value="">origem: todas</option>${opt('browser', 'browser')}${opt('agent', 'agent')}${opt('relay', 'relay')}</select>
<input name="kind" placeholder="tipo" value="${f.kind ?? ''}">
<input name="box" placeholder="box (nome ou id)" value="${f.box ?? ''}">
<button type="submit">Filtrar</button><a href="/reports">limpar</a></form>
<p class="dim">${v.rows.length} relatório(s), mais recentes primeiro (máx. 100).</p>
<div class="scroll"><table><thead><tr><th>Quando</th><th>Conta</th><th>Origem</th><th>Tipo</th><th>Box</th><th>Resumo</th></tr></thead>
<tbody>${rows}</tbody></table></div>`);
}

function eventsTable(events: unknown[], now: number): Html {
  const rows = events.slice(-500).map((e) => {
    const o = e && typeof e === 'object' ? (e as Record<string, unknown>) : { value: e };
    const { at, ev, ...rest } = o;
    const fields = Object.entries(rest).map(([k, x]) => `${k}=${typeof x === 'string' ? x : JSON.stringify(x)}`).join('  ');
    return html`<tr><td>${typeof at === 'string' ? when(at, now) : ''}</td><td>${ev}</td><td class="wrap">${fields}</td></tr>`;
  });
  return html`<h2>Eventos (${events.length})</h2><div class="scroll"><table><thead><tr><th>Quando</th><th>Evento</th><th>Campos</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function reportPage(r: DiagReport, email: string, label: string, now: number, health: Health): string {
  const p = r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : {};
  const events = Array.isArray(p.events) ? eventsTable(p.events, now) : html``;
  const lines = Array.isArray(p.lines) ? html`<h2>Linhas do agente</h2><pre>${p.lines.map(String).join('\n')}</pre>` : html``;
  return layout(`Relatório ${r.kind}`, health, html`<p><a href="/reports">← relatórios</a></p>
<h1>${r.source}/${r.kind}</h1>
<dl><dt>Quando</dt><dd>${brt(r.created_at)} (${ago(r.created_at, now)})</dd>
<dt>Conta</dt><dd>${email || '—'} <span class="dim">${r.account_id}</span></dd>
<dt>Box</dt><dd>${label || '—'} <span class="dim">${r.box_id ?? ''}</span></dd>
<dt>Versão</dt><dd>${r.app_version ?? '—'}</dd>
<dt>User agent</dt><dd>${r.user_agent ?? '—'}</dd>
<dt>Resumo</dt><dd>${summarize(r)}</dd>
<dt>Id</dt><dd class="dim">${r.id}</dd></dl>
${lines}${events}
<h2>Payload</h2><pre>${JSON.stringify(r.payload, null, 2)}</pre>`);
}

export function boxesPage(agents: AgentRow[], emails: Map<string, string>, now: number, health: Health): string {
  const rows = agents.map((a) => html`<tr>
<td>${a.label || '—'}<br><span class="dim">${a.id}</span></td>
<td>${emails.get(a.account_id) || a.account_id}</td>
<td>${a.kind}</td>
<td>${when(a.paired_at, now)}</td>
<td>${when(a.last_seen, now)}</td>
<td>${a.revoked_at ? html`<span class="bad">revogada</span><br><span class="dim">${brt(a.revoked_at)}</span>` : html`<span class="ok">ativa</span>`}</td>
<td><a href="${href('/reports', { box: a.id })}">relatórios</a></td></tr>`);
  return layout('Boxes', health, html`<h1>Boxes</h1>
<p class="dim">"Última conexão" vem do banco e só muda quando a box conecta no relay; não é presença ao vivo. O total online agora está na saúde, acima.</p>
<div class="scroll"><table><thead><tr><th>Box</th><th>Conta</th><th>Tipo</th><th>Pareada</th><th>Última conexão</th><th>Estado</th><th></th></tr></thead>
<tbody>${rows}</tbody></table></div>`);
}

export function errorPage(status: number, message: string, health: Health | null): string {
  return layout(String(status), health, html`<h1>${status}</h1><p>${message}</p><p><a href="/reports">voltar</a></p>`);
}
