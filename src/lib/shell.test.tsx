// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't', user: { email: 'ana@x.com' } } } }) } }, SUPABASE_ENABLED: true }));

import { inShell, postToShell } from './shell';
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
    const sent = post.mock.calls.map((c) => JSON.parse(c[0]));
    expect(sent.map((m) => m.kind)).toEqual(['turn-done', 'turn-error']);
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
