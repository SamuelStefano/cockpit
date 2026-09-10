import type { Message } from '../../data/types';
import { parseAttachments } from '../../lib/parse-attachments';

export interface ChatTopic {
  id: string;
  title: string;
  ts?: number;
}

export const TOPIC_TITLE_MAX = 56;
// Abaixo disto o navegador não ajuda: um prompt só é a conversa inteira.
export const TOPICS_MIN = 2;

// Cada prompt seu vira um tópico da conversa — é o que o usuário lembra ("pedi
// vagas", "pedi sobre mim"), não a resposta. Título = 1ª linha útil do prompt.
export function topicTitle(text: string): string {
  const { body } = parseAttachments(text);
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const clean = line.replace(/^[#>*\-\s]+/, '').replace(/\s+/g, ' ');
  if (clean.length <= TOPIC_TITLE_MAX) return clean;
  const cut = clean.slice(0, TOPIC_TITLE_MAX);
  const atWord = cut.lastIndexOf(' ');
  return `${(atWord > TOPIC_TITLE_MAX * 0.6 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

export function chatTopics(messages: Message[]): ChatTopic[] {
  const out: ChatTopic[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const title = topicTitle(m.text);
    if (!title) continue;
    out.push({ id: m.id, title, ts: m.ts });
  }
  return out;
}

// Tópico "corrente" = o último cujo topo já passou pela linha de leitura (um
// pouco abaixo do topo da viewport). Puro: recebe posições, não DOM.
export function activeTopicIndex(tops: number[], scrollTop: number, readLine = 96): number {
  let active = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= scrollTop + readLine) active = i;
  return active;
}
