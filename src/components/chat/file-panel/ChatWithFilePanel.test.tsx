// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ChatWithFilePanel } from './ChatWithFilePanel';
import { ToolCallCard } from '../ToolCallCard';
import { Markdown } from '../../primitives';
import { sessionFileKey } from '../../../cockpit/useSessionFiles';
import type { SessionFilesApi } from './useChatFilePanel';

afterEach(cleanup);

const text = (t: string) => ({ status: 'ok' as const, mime: 'text/plain', size: t.length, url: '', text: t });
const readTool = { id: 't1', name: 'Read', label: 'Read', command: 'src/hooks/x.ts', status: 'done', output: [] } as never;

const mount = (data: SessionFilesApi['data'] = {}, isMobile = false) => {
  const get = vi.fn();
  const view = render(
    <ChatWithFilePanel sessionId="s1" files={{ data, get }} isMobile={isMobile}>
      <ToolCallCard tool={readTool} />
      <Markdown md="see `README.md` and `npm run build`" />
    </ChatWithFilePanel>,
  );
  return { get, ...view };
};

describe('ChatWithFilePanel', () => {
  it('opens a read-only panel when a tool card path is clicked, and closes it', () => {
    const { get } = mount({ [sessionFileKey('s1', 'src/hooks/x.ts')]: text('a\nb') });
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    expect(get).toHaveBeenCalledWith('s1', 'src/hooks/x.ts');
    const panel = screen.getByRole('complementary');
    expect(panel.textContent).toContain('Somente leitura');
    expect(panel.textContent).toContain('a');
    expect(panel.textContent).toContain('2');
    fireEvent.click(screen.getByLabelText('Fechar arquivo'));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('turns inline-code paths into links, but not commands', () => {
    const { get } = mount();
    const links = screen.getAllByTitle('Abrir arquivo');
    expect(links).toHaveLength(2);
    fireEvent.click(links[1]);
    expect(get).toHaveBeenCalledWith('s1', 'README.md');
    expect(screen.getByRole('complementary').textContent).toContain('README.md');
  });

  it('is a full-screen sheet on mobile', () => {
    mount({}, true);
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    expect(screen.getByRole('complementary').className).toContain('fixed inset-0');
  });

  it('shows the server error', () => {
    mount({ [sessionFileKey('s1', 'src/hooks/x.ts')]: { status: 'error', error: 'arquivo sensível' } });
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    expect(screen.getByText('arquivo sensível')).toBeTruthy();
  });
});
