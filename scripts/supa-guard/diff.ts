// Pure, deterministic snapshot diffing for supa-guard. No I/O, no LLM: the same two
// snapshots always yield the same alerts. Every database-derived string is sanitized here.

import { sanitizeIdent, sanitizeText } from './sanitize';
import type { Snapshot, TableRow, PolicyRow } from './snapshot';

export type Severity = 'critical' | 'high' | 'medium';

export interface Alert {
  projectRef: string;
  projectName: string;
  severity: Severity;
  kind: string;
  subject: string;
  detail: string;
  fingerprint: string;
}

const WRITE_PRIVS = new Set(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']);
const WRITE_CMDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'ALL']);
const PUBLIC_GRANTEES = new Set(['anon', 'public']);
const TABLE_KINDS = new Set(['r', 'p']);

const s = sanitizeIdent;

function make(snap: Snapshot, severity: Severity, kind: string, subject: string, detail: string): Alert {
  const subj = s(subject);
  return {
    projectRef: snap.projectRef,
    projectName: s(snap.projectName),
    severity,
    kind,
    subject: subj,
    detail: sanitizeText(detail, 300),
    fingerprint: `${kind}:${subj}`,
  };
}

const tableKey = (t: { schema: string; name: string }) => `${t.schema}.${t.name}`;
const grantTableKey = (g: { schema: string; table: string }) => `${g.schema}.${g.table}`;
const fnKey = (f: { schema: string; name: string; args: string }) => `${f.schema}.${f.name}(${f.args})`;
const policyKey = (p: PolicyRow) => `${p.schema}.${p.table}.${p.name}`;
const policyDef = (p: PolicyRow) => JSON.stringify([p.roles, p.cmd, p.permissive, p.qual, p.with_check]);

function isOpenPolicy(p: PolicyRow): boolean {
  if (!p.roles.some((r) => PUBLIC_GRANTEES.has(r))) return false;
  if (!WRITE_CMDS.has(p.cmd.toUpperCase())) return false;
  const lit = (v: string | null) => (v ?? '').trim().toLowerCase() === 'true';
  return lit(p.qual) || lit(p.with_check);
}

function groupGrants(snap: Snapshot, pred: (g: Snapshot['grants'][number]) => boolean): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const g of snap.grants) {
    if (!pred(g)) continue;
    const k = grantTableKey(g);
    if (!out.has(k)) out.set(k, new Set());
    out.get(k)!.add(`${g.grantee}:${g.privilege}`);
  }
  return out;
}

const isWriteGrant = (snap: Snapshot) => (g: Snapshot['grants'][number]) =>
  PUBLIC_GRANTEES.has(g.grantee) && WRITE_PRIVS.has(g.privilege) && snap.exposedSchemas.includes(g.schema);

function noRlsTables(snap: Snapshot): TableRow[] {
  return snap.tables.filter((t) => TABLE_KINDS.has(t.kind) && !t.rls_enabled && snap.exposedSchemas.includes(t.schema));
}

function newPrivs(prev: Set<string> | undefined, now: Set<string>): string[] {
  return [...now].filter((p) => !prev?.has(p)).sort();
}

export function diffSnapshots(prev: Snapshot, next: Snapshot): Alert[] {
  const out: Alert[] = [];
  const exposed = (schema: string) => next.exposedSchemas.includes(schema);

  const prevSchemas = new Set(prev.schemas.map((x) => x.name));
  const nextSchemas = new Set(next.schemas.map((x) => x.name));
  for (const sc of next.schemas) {
    if (!prevSchemas.has(sc.name)) out.push(make(next, 'high', 'new_schema', sc.name, `New schema created, owner ${sc.owner}`));
  }
  for (const sc of prev.schemas) {
    if (!nextSchemas.has(sc.name)) out.push(make(next, 'high', 'dropped_schema', sc.name, 'Schema was dropped'));
  }

  const prevTables = new Map(prev.tables.map((t) => [tableKey(t), t]));
  for (const t of next.tables) {
    const before = prevTables.get(tableKey(t));
    const isTable = TABLE_KINDS.has(t.kind);
    if (!before) {
      if (!exposed(t.schema)) continue;
      const noRls = isTable && !t.rls_enabled;
      out.push(make(next, noRls ? 'critical' : 'medium', 'new_table', tableKey(t),
        `New ${isTable ? 'table' : 'view'} in exposed schema${noRls ? ' with RLS disabled' : ''}`));
    } else if (before.rls_enabled && !t.rls_enabled && isTable) {
      out.push(make(next, 'critical', 'rls_disabled', tableKey(t), 'Row level security was turned off'));
    }
  }

  const tableByKey = new Map(next.tables.map((t) => [tableKey(t), t]));
  const prevWrite = groupGrants(prev, isWriteGrant(prev));
  for (const [k, now] of groupGrants(next, isWriteGrant(next))) {
    const added = newPrivs(prevWrite.get(k), now);
    if (added.length) out.push(make(next, 'critical', 'anon_write_grant', k, `New write grants: ${added.join(', ')}`));
  }
  const selectPred = (snap: Snapshot) => (g: Snapshot['grants'][number]) =>
    PUBLIC_GRANTEES.has(g.grantee) && g.privilege === 'SELECT' && snap.exposedSchemas.includes(g.schema);
  const prevSel = groupGrants(prev, selectPred(prev));
  for (const [k, now] of groupGrants(next, selectPred(next))) {
    const t = tableByKey.get(k);
    if (!t || !TABLE_KINDS.has(t.kind) || t.rls_enabled) continue;
    const added = newPrivs(prevSel.get(k), now);
    if (added.length) out.push(make(next, 'critical', 'anon_select_no_rls', k, 'Anonymous SELECT on a table without RLS'));
  }

  const prevPolicies = new Map(prev.policies.map((p) => [policyKey(p), policyDef(p)]));
  for (const p of next.policies) {
    if (!isOpenPolicy(p)) continue;
    if (prevPolicies.get(policyKey(p)) === policyDef(p)) continue;
    out.push(make(next, 'high', 'open_write_policy', policyKey(p),
      `Policy allows ${p.cmd} for ${p.roles.join(',')} with a literal true condition`));
  }

  const prevFns = new Map(prev.functions.map((f) => [fnKey(f), f]));
  for (const f of next.functions) {
    if (!f.anon_exec || !exposed(f.schema)) continue;
    if (prevFns.get(fnKey(f))?.anon_exec) continue;
    out.push(make(next, 'high', 'anon_security_definer', fnKey(f), 'SECURITY DEFINER function executable by anon in an exposed schema'));
  }

  const prevCreate = new Set(prev.schemaCreate.map((c) => `${c.grantee}:${c.schema}`));
  for (const c of next.schemaCreate) {
    if (prevCreate.has(`${c.grantee}:${c.schema}`)) continue;
    out.push(make(next, 'critical', 'schema_create_grant', `${c.grantee} on ${c.schema}`, `${c.grantee} gained CREATE on schema`));
  }

  const prevEvt = new Map(prev.eventTriggers.map((e) => [e.name, e]));
  const nextEvt = new Map(next.eventTriggers.map((e) => [e.name, e]));
  for (const e of next.eventTriggers) {
    const before = prevEvt.get(e.name);
    if (!before) out.push(make(next, 'high', 'event_trigger_added', e.name, `Event trigger on ${e.event} runs ${e.function}`));
    else if (before.enabled !== e.enabled) {
      out.push(make(next, 'high', 'event_trigger_changed', e.name, `Event trigger state changed ${before.enabled} -> ${e.enabled}`));
    }
  }
  for (const e of prev.eventTriggers) {
    if (!nextEvt.has(e.name)) out.push(make(next, 'high', 'event_trigger_removed', e.name, 'Event trigger was removed'));
  }

  const prevRoles = new Map(prev.roles.map((r) => [r.name, r]));
  for (const r of next.roles) {
    const before = prevRoles.get(r.name);
    if (!before) {
      out.push(make(next, 'critical', 'new_role', r.name,
        `New role (super=${r.super}, login=${r.login}, bypassrls=${r.bypassrls}, createrole=${r.createrole})`));
      continue;
    }
    const gained = (['super', 'bypassrls', 'createrole'] as const).filter((f) => r[f] && !before[f]);
    if (gained.length) out.push(make(next, 'critical', 'role_escalated', r.name, `Role gained ${gained.join(', ')}`));
  }

  const prevLints = new Set(prev.lints.filter((l) => l.level === 'ERROR').map((l) => l.key));
  for (const l of next.lints) {
    if (l.level !== 'ERROR' || prevLints.has(l.key)) continue;
    out.push(make(next, 'high', 'advisor_error', `${l.name}: ${l.key}`, l.detail));
  }

  return out;
}

export function standingIssues(snap: Snapshot): Alert[] {
  const out: Alert[] = [];

  for (const t of noRlsTables(snap)) {
    out.push(make(snap, 'high', 'standing_no_rls', tableKey(t), 'Table in exposed schema has RLS disabled'));
  }
  for (const [k, privs] of groupGrants(snap, isWriteGrant(snap))) {
    out.push(make(snap, 'critical', 'standing_anon_write_grant', k, `Write grants: ${[...privs].sort().join(', ')}`));
  }
  for (const f of snap.functions) {
    if (f.anon_exec && snap.exposedSchemas.includes(f.schema)) {
      out.push(make(snap, 'high', 'standing_anon_security_definer', fnKey(f), 'SECURITY DEFINER function executable by anon in an exposed schema'));
    }
  }
  for (const c of snap.schemaCreate) {
    out.push(make(snap, 'critical', 'standing_schema_create', `${c.grantee} on ${c.schema}`, `${c.grantee} has CREATE on schema`));
  }
  for (const l of snap.lints) {
    if (l.level === 'ERROR') out.push(make(snap, 'high', 'standing_advisor_error', `${l.name}: ${l.key}`, l.detail));
  }

  return out;
}
