// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't', user: { email: 'ana@x.com' } } } }) } }, SUPABASE_ENABLED: true }));

import { inShell, postToShell, parseShellEvent, onShellEvent, dataUrlToFile, MAX_SCREENSHOT_CHARS } from './shell';
import { act } from '@testing-library/react';
import { useScreenshotOffer } from '../components/chat/useScreenshotOffer';
import { ScreenshotPrompt } from '../components/chat/ScreenshotPrompt';
import { notifyTurnDone, notifyTurnError } from './notify';
import { webauthnAvailable } from '../cockpit/passkey';
import { needsAiConsent, recordAiConsent } from './aiConsent';
import { BetaNote } from '../components/auth/BetaNote';
import { RelayVisibility } from '../components/auth/RelayVisibility';
import { AuthIntro } from '../components/auth/AuthIntro';
import { DeleteAccount } from '../components/auth/DeleteAccount';
import { AiConsentSheet } from '../components/chat/AiConsentSheet';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ExportMenu } from '../components/chat/ExportMenu';
import { CodeBlock } from '../components/primitives/CodeBlock';
import { settingsSections } from '../routes/configuracoes/sections';

const post = vi.fn();
const enterShell = () => { (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage: post }; };
const leaveShell = () => { delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView; };
const hide = () => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

beforeEach(() => { post.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); leaveShell(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });

describe('inShell', () => {
  it('is true only when ReactNativeWebView exists', () => {
    expect(inShell()).toBe(false);
    enterShell();
    expect(inShell()).toBe(true);
  });
  it('posts JSON to the bridge, and does nothing in a browser', () => {
    expect(postToShell({ type: 'notify', kind: 'turn-done', title: 'a', body: 'b', tag: 'c' })).toBe(false);
    enterShell();
    expect(postToShell({ type: 'notify', kind: 'turn-done', title: 'a', body: 'b', tag: 'c' })).toBe(true);
    expect(JSON.parse(post.mock.calls[0][0])).toMatchObject({ v: 1, type: 'notify', kind: 'turn-done' });
  });
});

describe('turn-end notification', () => {
  it('goes through the bridge in the shell', () => {
    enterShell(); hide();
    notifyTurnDone('Minha sessão', undefined, 'k1');
    notifyTurnError('Minha sessão', 'falhou', undefined, 'k1');
    const sent = post.mock.calls.map((c) => JSON.parse(c[0])).filter((m: { type: string }) => m.type === 'notify');
    expect(sent.map((m: { kind: string }) => m.kind)).toEqual(['turn-done', 'turn-error']);
    expect(sent[0].tag).toBe('cockpit-done:k1');
  });
  it('never touches the bridge in a browser', () => {
    hide();
    notifyTurnDone('x');
    expect(post).not.toHaveBeenCalled();
  });
  it('stays silent in the shell while the user is looking', () => {
    enterShell();
    notifyTurnDone('x');
    expect(post).not.toHaveBeenCalled();
  });
});

describe('shell hides what the store build must not offer', () => {
  it('passkeys: WebAuthn is never offered in the shell', () => {
    (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = function PublicKeyCredential() {};
    Object.defineProperty(navigator, 'credentials', { value: {}, configurable: true });
    expect(webauthnAvailable()).toBe(true);
    enterShell();
    expect(webauthnAvailable()).toBe(false);
  });

  const exportMenu = () => render(<ExportMenu title="t" messages={[]} sessionId="s1" />);
  it('share creation: offered in a browser, hidden in the shell', () => {
    exportMenu();
    expect(screen.queryByTitle('Criar link público desta conversa')).not.toBeNull();
    cleanup();
    enterShell();
    exportMenu();
    expect(screen.queryByTitle('Criar link público desta conversa')).toBeNull();
  });

  it('LivePreview: agent code stays highlighted text in the shell', () => {
    enterShell();
    const { container } = render(<CodeBlock code="<h1>oi</h1>" lang="preview-html" />);
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.textContent).toContain('<h1>oi</h1>');
  });

  const header = (phone: boolean) => render(
    <ChatHeader
      session={{ id: 's1', title: 'Conversa' } as never} messages={[]} isEmpty={false} isMobile={phone} contextTokens={0}
      onNew={vi.fn()} fullLoaded={false} setFullLoaded={vi.fn()} onMenu={phone ? vi.fn() : undefined}
      usage={{ planUsage: null, stats: null }}
    />,
  );
  it('UsageDock and the phone usage line: shown in a browser, gone in the shell', () => {
    header(false);
    expect(screen.queryAllByLabelText(/Uso do plano/).length).toBeGreaterThan(0);
    cleanup();
    header(true);
    fireEvent.click(screen.getByLabelText(/Mais ações da conversa/));
    expect(document.body.textContent).toMatch(/Uso do plano/);
    cleanup();

    enterShell();
    header(false);
    expect(screen.queryAllByLabelText(/Uso do plano/)).toHaveLength(0);
    cleanup();
    header(true);
    fireEvent.click(screen.getByLabelText(/Mais ações da conversa/));
    expect(document.body.textContent).not.toMatch(/Uso do plano/);
  });

  it('settings: the Uso section is dropped in the shell only', () => {
    expect(settingsSections('root', true).map((s) => s.id)).toContain('uso');
    enterShell();
    expect(settingsSections('root', true).map((s) => s.id)).not.toContain('uso');
  });
});

describe('AI consent', () => {
  it('is only required in the shell, once per account', () => {
    expect(needsAiConsent('u1')).toBe(false);
    enterShell();
    expect(needsAiConsent('u1')).toBe(true);
    recordAiConsent('u1');
    expect(needsAiConsent('u1')).toBe(false);
    expect(needsAiConsent('u2')).toBe(true);
  });
  it('the sheet names the provider and offers Agree', () => {
    render(<AiConsentSheet open onAgree={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('provedor de IA');
    expect(screen.getByRole('button', { name: 'Concordo' })).toBeTruthy();
  });
});

describe('store-facing copy has no commerce words in the shell', () => {
  // Word-bounded so "planejar" (to plan) is not a hit; "plano"/"plan" (a paid tier) is.
  const FORBIDDEN = /\b(price|pricing|plan|plans|plano|planos|assinatura|assinaturas|subscribe|subscription|checkout)\b|R\$/i;

  it('flags the words it should (self-check)', () => {
    for (const w of ['price', 'Uso do plano', 'assinatura', 'subscribe', 'checkout', 'R$ 10']) expect(w).toMatch(FORBIDDEN);
    expect('Chat com o Claude em planejar, executar').not.toMatch(FORBIDDEN);
  });

  it('every component visible in the shell is clean', async () => {
    enterShell();
    const seen: Record<string, string> = {};
    const grab = (name: string, node: React.ReactElement) => { const r = render(node); seen[name] = r.container.textContent ?? ''; r.unmount(); };
    grab('BetaNote', <BetaNote />);
    grab('RelayVisibility', <RelayVisibility />);
    grab('AuthIntro', <AuthIntro />);
    grab('AiConsentSheet', <AiConsentSheet open onAgree={vi.fn()} onDecline={vi.fn()} />);
    grab('ExportMenu', <ExportMenu title="t" messages={[]} sessionId="s1" />);
    grab('CodeBlock', <CodeBlock code="x" lang="preview-html" />);
    const h = render(
      <ChatHeader session={{ id: 's1', title: 'Conversa' } as never} messages={[]} isEmpty={false} isMobile contextTokens={0} onNew={vi.fn()} fullLoaded={false} setFullLoaded={vi.fn()} onMenu={vi.fn()} usage={{ planUsage: null, stats: null }} />,
    );
    fireEvent.click(screen.getByLabelText(/Mais ações da conversa/));
    seen.ChatHeader = document.body.textContent ?? '';
    h.unmount();
    const d = render(<DeleteAccount onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }));
    await screen.findByText('ana@x.com');
    seen.DeleteAccount = document.body.textContent ?? '';
    d.unmount();
    seen.settings = settingsSections('root', true).map((s) => s.label).join(' ');
    for (const [name, text] of Object.entries(seen)) {
      expect(text.length, name).toBeGreaterThan(0);
      expect(text, name).not.toMatch(FORBIDDEN);
    }
  });
});

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const emit = (detail: unknown) => act(() => { window.dispatchEvent(new CustomEvent('deck-shell', { detail })); });
const sent = () => post.mock.calls.map((c) => JSON.parse(c[0]));

describe('parseShellEvent', () => {
  it('accepts the three events', () => {
    expect(parseShellEvent({ type: 'screenshots-status', status: 'limited' })).toEqual({ type: 'screenshots-status', status: 'limited' });
    expect(parseShellEvent({ type: 'screenshot-available', id: 'A/L0/001', thumbnail: JPEG })).toMatchObject({ id: 'A/L0/001' });
    expect(parseShellEvent({ type: 'screenshot-data', id: 'A/L0/001', dataUrl: JPEG })).toMatchObject({ dataUrl: JPEG });
  });
  it('refuses anything else', () => {
    for (const bad of [null, 'x', [], {}, { type: 'nope' }, { type: 'screenshots-status', status: 'maybe' },
      { type: 'screenshot-available', id: 'a b', thumbnail: JPEG },
      { type: 'screenshot-available', id: 'ok', thumbnail: 'https://evil.com/x.jpg' },
      { type: 'screenshot-data', id: 'ok', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { type: 'screenshot-data', id: 'ok', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(MAX_SCREENSHOT_CHARS) },
      { type: 'screenshot-data', id: 'ok', dataUrl: 'data:image/jpeg;base64,AA"onerror="x' }]) {
      expect(parseShellEvent(bad)).toBeNull();
    }
  });
});

describe('dataUrlToFile', () => {
  it('builds a JPEG File with the decoded bytes, and refuses non-JPEG', () => {
    const f = dataUrlToFile(JPEG, 'p.jpg')!;
    expect(f.name).toBe('p.jpg');
    expect(f.type).toBe('image/jpeg');
    expect(f.size).toBe(atob('/9j/4AAQSkZJRg==').length);
    expect(dataUrlToFile('data:text/html;base64,AAAA', 'x')).toBeNull();
  });
});

describe('onShellEvent', () => {
  it('does nothing in a browser', () => {
    const cb = vi.fn();
    const off = onShellEvent(cb);
    emit({ type: 'screenshots-status', status: 'granted' });
    expect(cb).not.toHaveBeenCalled();
    off();
  });
});

function Harness({ onUpload }: { onUpload: (f: File) => void }) {
  const s = useScreenshotOffer(onUpload);
  return <ScreenshotPrompt s={s} />;
}

describe('screenshot offer', () => {
  it('renders nothing and sends nothing in a browser, even with the opt-in set', () => {
    localStorage.setItem('deckScreenshotsOptIn', '1');
    const { container } = render(<Harness onUpload={vi.fn()} />);
    emit({ type: 'screenshot-available', id: 'A', thumbnail: JPEG });
    expect(container.textContent).toBe('');
    expect(post).not.toHaveBeenCalled();
  });

  it('asks first, sends screenshots-enable only after the user taps', () => {
    enterShell();
    render(<Harness onUpload={vi.fn()} />);
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Ativar prints automáticos'));
    expect(sent()).toEqual([{ v: 1, type: 'screenshots-enable' }]);
    expect(localStorage.getItem('deckScreenshotsOptIn')).toBe('1');
  });

  it('re-sends enable on load when this device opted in', () => {
    enterShell();
    localStorage.setItem('deckScreenshotsOptIn', '1');
    render(<Harness onUpload={vi.fn()} />);
    expect(sent()).toEqual([{ v: 1, type: 'screenshots-enable' }]);
  });

  it('"Agora não" on the opt-in hides it for good without messaging the shell', () => {
    enterShell();
    const { unmount } = render(<Harness onUpload={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Dispensar aviso'));
    expect(screen.queryByText('Ativar prints automáticos')).toBeNull();
    unmount();
    render(<Harness onUpload={vi.fn()} />);
    expect(screen.queryByText('Ativar prints automáticos')).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows the prompt, and Colar accepts then uploads the file once, as a pending attachment', () => {
    enterShell();
    localStorage.setItem('deckScreenshotsOptIn', '1');
    const onUpload = vi.fn();
    render(<Harness onUpload={onUpload} />);
    post.mockReset();
    emit({ type: 'screenshot-available', id: 'A/L0/001', thumbnail: JPEG });
    expect(screen.getByText('Colar o print no chat?')).toBeTruthy();
    expect(screen.getByAltText('Miniatura do print')).toBeTruthy();
    expect(onUpload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Colar'));
    expect(sent()).toEqual([{ v: 1, type: 'screenshot-accept', id: 'A/L0/001' }]);
    expect(onUpload).not.toHaveBeenCalled();
    emit({ type: 'screenshot-data', id: 'A/L0/001', dataUrl: JPEG });
    emit({ type: 'screenshot-data', id: 'A/L0/001', dataUrl: JPEG });
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[0][0]).toBeInstanceOf(File);
    expect(onUpload.mock.calls[0][0].type).toBe('image/jpeg');
    expect(screen.queryByText('Colar o print no chat?')).toBeNull();
  });

  it('ignores data nobody accepted, and data for another id', () => {
    enterShell();
    localStorage.setItem('deckScreenshotsOptIn', '1');
    const onUpload = vi.fn();
    render(<Harness onUpload={onUpload} />);
    emit({ type: 'screenshot-data', id: 'A', dataUrl: JPEG });
    emit({ type: 'screenshot-available', id: 'A', thumbnail: JPEG });
    fireEvent.click(screen.getByText('Colar'));
    emit({ type: 'screenshot-data', id: 'B', dataUrl: JPEG });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('Agora não drops the offer and sends nothing', () => {
    enterShell();
    localStorage.setItem('deckScreenshotsOptIn', '1');
    const onUpload = vi.fn();
    render(<Harness onUpload={onUpload} />);
    post.mockReset();
    emit({ type: 'screenshot-available', id: 'A', thumbnail: JPEG });
    fireEvent.click(screen.getByText('Agora não'));
    expect(screen.queryByText('Colar o print no chat?')).toBeNull();
    expect(post).not.toHaveBeenCalled();
    emit({ type: 'screenshot-data', id: 'A', dataUrl: JPEG });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('explains denied and limited access', () => {
    enterShell();
    localStorage.setItem('deckScreenshotsOptIn', '1');
    render(<Harness onUpload={vi.fn()} />);
    emit({ type: 'screenshots-status', status: 'denied' });
    expect(screen.getByText(/Sem acesso às fotos/)).toBeTruthy();
    emit({ type: 'screenshots-status', status: 'limited' });
    expect(screen.getByText(/Acesso limitado às fotos/)).toBeTruthy();
  });
});
