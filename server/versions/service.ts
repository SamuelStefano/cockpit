import { findAgent, restoreAgent, validAgent } from '../agents/store';
import { VERSION_ID_RE, type VersionKind, type VersionMeta } from '../../shared/versions';
import type { AgentConfig } from '../../shared/agents';
import { unifiedDiff } from './diff';
import { captureSkill, writeSkillMd } from './skill-history';
import { listVersions, readVersion } from './snapshots';

export async function versionsFor(kind: VersionKind, id: string): Promise<VersionMeta[]> {
  if (kind === 'skill') await captureSkill(id);
  return listVersions(kind, id);
}

export async function diffVersions(kind: VersionKind, id: string, from: string, to: string): Promise<{ ok: true; diff: string } | { ok: false; message: string }> {
  const a = await readVersion(kind, id, from);
  const b = await readVersion(kind, id, to);
  if (!a || !b) return { ok: false, message: 'versão não encontrada' };
  return { ok: true, diff: unifiedDiff(a.content, b.content, from, to) };
}

export async function restoreVersion(kind: VersionKind, id: string, version: string): Promise<{ ok: boolean; message: string }> {
  if (!VERSION_ID_RE.test(version)) return { ok: false, message: 'versão inválida' };
  const snap = await readVersion(kind, id, version);
  if (!snap) return { ok: false, message: 'versão não encontrada' };
  if (snap.deleted) return { ok: false, message: 'essa versão marca a remoção — escolha uma anterior' };
  const note = `restaurada de ${version}`;
  if (kind === 'skill') {
    await captureSkill(id);
    if (!(await writeSkillMd(id, snap.content))) return { ok: false, message: 'falha ao gravar a skill' };
    await captureSkill(id, note);
    return { ok: true, message: 'skill restaurada' };
  }
  let agent: unknown;
  try { agent = JSON.parse(snap.content); } catch { return { ok: false, message: 'versão ilegível' }; }
  if (!validAgent(agent) || (agent as AgentConfig).id !== id) return { ok: false, message: 'versão com dados inválidos' };
  await restoreAgent(agent as AgentConfig, note);
  return { ok: true, message: findAgent(id) ? 'agente restaurado' : 'falha ao restaurar' };
}
