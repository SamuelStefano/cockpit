import { appendFileSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// Trilha em disco das falhas de TURNO. Os erros do app viviam só no websocket:
// apareciam (ou não) na tela e sumiam — não havia o que monitorar depois. Este
// arquivo é o log que o triador de incidentes (scripts/incident-ai.sh) lê pra
// acordar quando algo quebra e investigar com o histórico na mão.
const INCIDENTS_PATH = process.env.COCKPIT_INCIDENTS ?? join(homedir(), '.cockpit', 'incidents.jsonl');

// Teto do arquivo: é lido por um one-shot de IA, e log sem teto vira prompt caro
// (e engole o disco da box, que é pequena).
const CAP_BYTES = 256 * 1024;
const KEEP_LINES = 200;

export type IncidentKind = 'silent-death' | 'orphan-resume' | 'run-error' | 'resume-exhausted';

export interface Incident {
  ts: string;
  kind: IncidentKind;
  sessionKey: string;
  sessionId?: string;
  // Só fato estrutural (duração, contagem, stderr do processo). NUNCA prompt do
  // usuário nem texto do modelo: este arquivo é colado no prompt de um triador de IA
  // com permissão de escrita, então conteúdo de conversa aqui seria um vetor de
  // injeção — e o log fica em disco em claro.
  detail?: string;
}

// Best-effort em tudo: registrar incidente NUNCA pode derrubar o turno que já está
// falhando (era o cenário de erro em cima de erro).
export function recordIncident(i: Omit<Incident, 'ts'>): void {
  try {
    mkdirSync(dirname(INCIDENTS_PATH), { recursive: true });
    rotateIfBig();
    appendFileSync(INCIDENTS_PATH, `${JSON.stringify({ ts: new Date().toISOString(), ...i })}\n`, 'utf8');
  } catch { /* log é diagnóstico, não crítico */ }
}

function rotateIfBig(): void {
  try {
    if (statSync(INCIDENTS_PATH).size <= CAP_BYTES) return;
    const kept = readFileSync(INCIDENTS_PATH, 'utf8').split('\n').filter(Boolean).slice(-KEEP_LINES);
    writeFileSync(INCIDENTS_PATH, `${kept.join('\n')}\n`, 'utf8');
  } catch { /* não existe ainda, ou corrompido: o append recria */ }
}
