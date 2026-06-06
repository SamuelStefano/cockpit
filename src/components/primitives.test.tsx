// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Markdown } from './primitives';

afterEach(cleanup);

describe('Markdown — blocos', () => {
  it('renderiza tabela GFM como <table> com header e linhas', () => {
    const { container } = render(
      <Markdown md={'| Nome | Idade |\n| --- | --- |\n| Ana | 30 |\n| Bia | 25 |'} />,
    );
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(container.querySelectorAll('thead th').length).toBe(2);
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('Idade')).toBeTruthy();
  });

  it('renderiza fenced code com linha em branco sem vazar as crases', () => {
    const md = '```ts\nconst a = 1;\n\nconst b = 2;\n```';
    const { container } = render(<Markdown md={md} />);
    expect(container.textContent).toContain('const a = 1;');
    expect(container.textContent).toContain('const b = 2;');
    expect(container.textContent).not.toContain('```');
  });

  it('renderiza task list GFM como checkboxes (done risca)', () => {
    const { container } = render(<Markdown md={'- [ ] pendente\n- [x] feito'} />);
    expect(container.textContent).not.toContain('[ ]');
    expect(container.textContent).not.toContain('[x]');
    const struck = container.querySelector('.line-through');
    expect(struck?.textContent).toContain('feito');
  });

  it('renderiza headings h1-h6 (#### não vira literal)', () => {
    const { container } = render(<Markdown md={'#### subtítulo'} />);
    expect(container.textContent).toBe('subtítulo');
    expect(container.textContent).not.toContain('#');
  });

  it('renderiza horizontal rule', () => {
    const { container } = render(<Markdown md={'antes\n\n---\n\ndepois'} />);
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('renderiza blockquote sem o > cru', () => {
    const { container } = render(<Markdown md={'> citação aqui'} />);
    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(container.textContent).toContain('citação aqui');
    expect(container.textContent).not.toContain('>');
  });

  it('renderiza lista ordenada e não-ordenada', () => {
    const { container: ol } = render(<Markdown md={'1. um\n2. dois'} />);
    expect(ol.querySelector('ol')).not.toBeNull();
    cleanup();
    const { container: ul } = render(<Markdown md={'- a\n- b'} />);
    expect(ul.querySelector('ul')).not.toBeNull();
  });
});

describe('Markdown — inline', () => {
  it('bold, itálico e strikethrough', () => {
    const { container } = render(<Markdown md={'**forte** e *fraco* e ~~riscado~~'} />);
    expect(container.querySelector('strong')?.textContent).toBe('forte');
    expect(container.querySelector('em')?.textContent).toBe('fraco');
    expect(container.querySelector('.line-through')?.textContent).toBe('riscado');
  });

  it('code inline vira <code>', () => {
    const { container } = render(<Markdown md={'use `npm test` aqui'} />);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('npm test');
  });

  it('auto-link de URL crua, sem engolir pontuação final', () => {
    const { container } = render(<Markdown md={'veja https://exemplo.com.'} />);
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://exemplo.com');
    expect(container.textContent).toContain('https://exemplo.com.');
  });

  it('markdown link usa o texto, não a URL', () => {
    const { container } = render(<Markdown md={'[clique](https://x.dev)'} />);
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://x.dev');
    expect(a?.textContent).toBe('clique');
  });
});
