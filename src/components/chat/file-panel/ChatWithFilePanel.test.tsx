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

const grepTool = { id: 't2', name: 'Grep', label: 'Grep', command: 'foo.ts', status: 'done', output: [] } as never;

const mount = (data: SessionFilesApi['data'] = {}, isMobile = false, sessionId = 's1') => {
  const get = vi.fn();
  const tree = (sid: string) => (
    <ChatWithFilePanel sessionId={sid} files={{ data, get }} isMobile={isMobile}>
      <ToolCallCard tool={grepTool} />
      <ToolCallCard tool={readTool} />
      <Markdown md="see `README.md`, `src/a.ts:3`, `console.log` and `npm run build`" />
    </ChatWithFilePanel>
  );
  const view = render(tree(sessionId));
  return { get, tree, ...view };
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

  it('turns inline-code paths into links, but not commands, member accesses or a Grep pattern', () => {
    const { get } = mount();
    const links = screen.getAllByTitle('Abrir arquivo');
    expect(links).toHaveLength(3);
    fireEvent.click(links[1]);
    expect(get).toHaveBeenCalledWith('s1', 'README.md');
    expect(screen.getByRole('complementary').textContent).toContain('README.md');
  });

  it('opens at the line the reference names', () => {
    const { get } = mount({ [sessionFileKey('s1', 'src/a.ts')]: text('one\ntwo\nthree\nfour') });
    fireEvent.click(screen.getByText('src/a.ts:3'));
    expect(get).toHaveBeenCalledWith('s1', 'src/a.ts');
    expect(screen.getByRole('complementary').querySelector('[aria-current="location"]')?.textContent).toBe('3three');
  });

  it('closes on Esc from inside the panel and gives focus back to the link', () => {
    mount();
    const link = screen.getAllByTitle('Abrir arquivo')[0];
    link.focus();
    fireEvent.click(link);
    const panel = screen.getByRole('complementary');
    expect(document.activeElement).toBe(panel);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(document.activeElement).toBe(link);
  });

  it('leaves Esc alone while focus is in the chat', () => {
    mount();
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByRole('complementary')).toBeTruthy();
  });

  it('copies the path', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    mount();
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    fireEvent.click(screen.getByLabelText('Copiar caminho'));
    expect(writeText).toHaveBeenCalledWith('src/hooks/x.ts');
  });

  it('hides the panel in the same render when the session changes', () => {
    const { rerender, tree } = mount();
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    rerender(tree('s2'));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('is a bare full-screen sheet on mobile: back, file name, content', () => {
    mount({ [sessionFileKey('s1', 'src/hooks/x.ts')]: text('a\nb') }, true);
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    const sheet = screen.getByRole('dialog');
    expect(sheet.className).toContain('fixed inset-0');
    expect(sheet.querySelectorAll('button')).toHaveLength(1);
    expect(sheet.textContent).toBe('x.ts1a2b');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the mobile sheet on the back gesture', () => {
    mount({}, true);
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    history.replaceState({}, '');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the server error', () => {
    mount({ [sessionFileKey('s1', 'src/hooks/x.ts')]: { status: 'error', error: 'arquivo sensível' } });
    fireEvent.click(screen.getAllByTitle('Abrir arquivo')[0]);
    expect(screen.getByText('arquivo sensível')).toBeTruthy();
  });
});
