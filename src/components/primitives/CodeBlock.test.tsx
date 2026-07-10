// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  it('renderiza o código como texto puro antes do highlighter (fallback)', () => {
    const code = 'const x = 1; # not a comment in js';
    const { container } = render(<CodeBlock code={code} lang="ts" />);
    // shiki carrega assíncrono; o render síncrono mostra o texto puro (sem cores).
    expect(container.textContent).toContain(code);
  });

  it('mostra o rótulo da linguagem no header', () => {
    const { container } = render(<CodeBlock code="echo oi" lang="bash" />);
    expect(container.textContent).toContain('bash');
  });

  it('sem linguagem rotula "text"', () => {
    const { container } = render(<CodeBlock code="qualquer coisa" />);
    expect(container.textContent).toContain('text');
  });
});
