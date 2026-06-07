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

// PDF real (jspdf carregado sob demanda — fica fora do bundle inicial). Texto
// fluido paginado, não o print do navegador. Cada turno vira blocos de linhas.
export async function threadToPdf(title: string, messages: Message[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) { doc.addPage(); y = margin; }
  };
  const write = (text: string, size: number, color: [number, number, number], style: 'normal' | 'bold' = 'normal', font = 'helvetica') => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lh = size * 1.4;
    for (const para of text.split('\n')) {
      // splitTextToSize descarta o whitespace inicial — preserva indentação de
      // código/listas aninhadas medindo o recuo e deslocando o x das linhas
      // (tab = 2 espaços). Continuações de uma linha longa herdam o mesmo recuo.
      const raw = para.replace(/\t/g, '  ');
      const indent = raw.match(/^ */)![0];
      const indentW = indent ? doc.getTextWidth(indent) : 0;
      const lines = doc.splitTextToSize(raw.slice(indent.length) || ' ', maxW - indentW) as string[];
      for (const ln of lines) { ensure(lh); doc.text(ln, margin + indentW, y); y += lh; }
    }
  };

  write(title, 18, [20, 20, 20], 'bold');
  y += 8;

  for (const m of messages) {
    ensure(28);
    if (m.role === 'user') {
      write('Você', 11, [180, 90, 0], 'bold');
      write(m.text.trim(), 10.5, [40, 40, 40]);
    } else {
      write('Claude', 11, [120, 80, 200], 'bold');
      for (const b of m.blocks) {
        if (b.type === 'text') write(b.md.trim(), 10.5, [40, 40, 40]);
        else if (b.type === 'code') write(b.code, 9.5, [30, 30, 30], 'normal', 'courier');
        else if (b.type === 'tool') {
          write(`$ ${b.tool.command || b.tool.label}`, 9.5, [90, 90, 90], 'normal', 'courier');
          const o = b.tool.output.join('').trim();
          if (o) write(o, 9, [110, 110, 110], 'normal', 'courier');
        }
      }
    }
    y += 10;
  }

  doc.save(`${fileSlug(title)}.pdf`);
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
