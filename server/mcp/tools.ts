import { listContexts, readContext } from '../contexts';
import { listSessions } from '../sessions/index';
import { searchSessions } from '../sessions/search';
import { parseSession } from '../sessions/parse';
import { transcriptText } from '../summary';
import { listSkills, readSkill } from '../skills';
import {
  clampNumber,
  formatContexts,
  formatSessions,
  formatSkills,
  SESSIONS_DEFAULT,
  SESSIONS_MAX,
  TRANSCRIPT_DEFAULT,
  TRANSCRIPT_MAX,
} from './format';

// Execução das tools MCP: dá a um cliente externo (Cursor, outro agente) o MESMO
// surfacing read-only que a aba Contextos/Skills e o sidebar de sessões já
// mostram. Nenhuma tool escreve nem spawna — os write paths do memoryDir
// (installContext, handoff) ficam de fora de propósito: quem só quer LER o
// contexto não precisa deles, e mantê-los fora deixa esta fronteira trivial de
// auditar.

// Devolve TEXTO, não JSON: do outro lado quem lê é um modelo, e markdown curto
// gasta menos contexto que um objeto serializado. Lança quando o alvo não existe
// — o caller traduz pra isError do protocolo.
export async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'contexts_list':
      return formatContexts(await listContexts());

    case 'contexts_read': {
      const id = String(args.id ?? '');
      const ctx = await readContext(id);
      if (!ctx) throw new Error(`contexto '${id}' não encontrado`);
      return `# ${ctx.title}\n\n${ctx.body}`;
    }

    case 'sessions_list': {
      const limit = clampNumber(args.limit, SESSIONS_DEFAULT, SESSIONS_MAX);
      return formatSessions((await listSessions()).slice(0, limit));
    }

    case 'sessions_search':
      return formatSessions(await searchSessions(String(args.query ?? '')));

    case 'sessions_read': {
      const id = String(args.id ?? '');
      const parsed = await parseSession(id);
      if (!parsed || parsed.messages.length === 0) throw new Error(`sessão '${id}' não encontrada ou sem conversa`);
      return transcriptText(parsed.messages, clampNumber(args.chars, TRANSCRIPT_DEFAULT, TRANSCRIPT_MAX));
    }

    case 'skills_list':
      return formatSkills(await listSkills());

    case 'skills_read': {
      const id = String(args.id ?? '');
      const skill = await readSkill(id);
      if (!skill) throw new Error(`skill '${id}' não encontrada`);
      return skill.body;
    }
  }
  throw new Error(`tool desconhecida: ${name}`);
}
