import type { Message, Block } from '../data/mock';

// Serializa a thread em Markdown — 100% client-side, os dados já vivem no
// messages[] do useCockpit. Sem backend, sem dep.
export function threadToMarkdown(title: string, messages: Message[]): string {
  const out: string[] = [`# ${title}`, ''];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push('## 🧑 Você', '', m.text.trim(), '');
      continue;
    }
    out.push('## 🤖 Claude', '');
    for (const b of m.blocks) {
      if (b.type === 'text') out.push(b.md.trim(), '');
      else if (b.type === 'code') out.push('```' + (b.lang || ''), b.code, '```', '');
      else if (b.type === 'tool') {
        out.push(`> \`$ ${b.tool.command || b.tool.label}\``);
        const o = b.tool.output.join('').trim();
        if (o) out.push('>', '> ```', ...o.split('\n').map((l) => '> ' + l), '> ```');
        out.push('');
      }
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// Texto copiável de uma única mensagem do assistente (texto + code blocks).
export function messageToText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text') out.push(b.md.trim());
    else if (b.type === 'code') out.push('```' + (b.lang || ''), b.code, '```');
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function download(name: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// slug seguro pra nome de arquivo a partir do título da sessão.
export function fileSlug(title: string): string {
  return (title || 'sessao').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sessao';
}

// Extensão por linguagem do code block (download individual).
const LANG_EXT: Record<string, string> = {
  ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', json: 'json', py: 'py', python: 'py',
  bash: 'sh', sh: 'sh', shell: 'sh', go: 'go', rust: 'rs', rs: 'rs', sql: 'sql',
  html: 'html', css: 'css', md: 'md', markdown: 'md', yaml: 'yaml', yml: 'yml', toml: 'toml',
};

export function codeExt(lang: string): string {
  return LANG_EXT[(lang || '').toLowerCase()] ?? 'txt';
}
